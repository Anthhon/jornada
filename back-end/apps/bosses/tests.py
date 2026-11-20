from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import SimpleTestCase, TestCase

from apps.spells.models import Spell
from apps.test_helpers import anon_client, staff_client, user_client

from . import engine as boss_engine
from .engine import Ability
from .models import Boss, BossAbility, BossSpell, Choice, Question


class BossApiTests(TestCase):
    """CRUD de chefes + vínculo com feitiços (peso da IA) + perguntas."""

    def setUp(self):
        self.fogo = Spell.objects.create(name="Brasa", base_value=3)
        self.gelo = Spell.objects.create(name="Gelo", base_value=4)

    # --- Boss ---------------------------------------------------------------

    def test_listagem_publica(self):
        Boss.objects.create(name="Mago Corrompido", max_hp=200)
        resp = anon_client().get("/api/bosses/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data[0]["max_hp"], 200)

    def test_visitante_nao_escreve(self):
        resp = anon_client().post("/api/bosses/", {"name": "X"}, format="json")
        self.assertIn(resp.status_code, (401, 403))

    def test_aluno_logado_nao_escreve(self):
        resp = user_client().post("/api/bosses/", {"name": "X"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_ciclo_do_professor_com_feiticos(self):
        client = staff_client()
        criado = client.post(
            "/api/bosses/",
            {"name": "Rei Draga", "max_hp": 130, "spells": [self.fogo.id]},
            format="json",
        )
        self.assertEqual(criado.status_code, 201)
        self.assertEqual(criado.data["spell_names"], ["Brasa"])
        # .set() no M2M com through criou a linha BossSpell com peso padrão 1
        self.assertEqual(
            BossSpell.objects.get(boss_id=criado.data["id"]).weight, 1
        )

        url = f"/api/bosses/{criado.data['id']}/"
        alterado = client.patch(
            url, {"spells": [self.fogo.id, self.gelo.id]}, format="json"
        )
        self.assertEqual(alterado.status_code, 200)
        # resposta do PATCH reflete os feitiços novos (sem cache velho)
        self.assertEqual(alterado.data["spell_names"], ["Brasa", "Gelo"])
        self.assertEqual(BossSpell.objects.filter(boss_id=criado.data["id"]).count(), 2)

        self.assertEqual(client.delete(url).status_code, 204)
        self.assertFalse(Boss.objects.exists())

    # --- BossSpell (peso da IA) ---------------------------------------------

    def test_peso_do_feitico_editavel_e_unico(self):
        boss = Boss.objects.create(name="Chefe Áspero")
        client = staff_client()

        criado = client.post(
            "/api/boss-spells/",
            {"boss": boss.id, "spell": self.fogo.id, "weight": 5},
            format="json",
        )
        self.assertEqual(criado.status_code, 201)
        self.assertEqual(criado.data["weight"], 5)
        self.assertEqual(criado.data["boss_name"], "Chefe Áspero")

        url = f"/api/boss-spells/{criado.data['id']}/"
        alterado = client.patch(url, {"weight": 3}, format="json")
        self.assertEqual(alterado.status_code, 200)

        # vínculo duplicado (boss, spell) viola a UniqueConstraint → 400
        duplicado = client.post(
            "/api/boss-spells/",
            {"boss": boss.id, "spell": self.fogo.id},
            format="json",
        )
        self.assertEqual(duplicado.status_code, 400)

    # --- Question / Choice ---------------------------------------------------

    def test_pergunta_com_alternativas_aninhadas(self):
        boss = Boss.objects.create(name="Chefe Perguntas")
        client = staff_client()

        pergunta = client.post(
            "/api/questions/",
            {"boss": boss.id, "text": "O que é um laço?", "points": 10},
            format="json",
        )
        self.assertEqual(pergunta.status_code, 201)
        self.assertEqual(pergunta.data["choices"], [])

        alternativa = client.post(
            "/api/choices/",
            {"question": pergunta.data["id"], "text": "Repetição", "is_correct": True},
            format="json",
        )
        self.assertEqual(alternativa.status_code, 201)

        detalhe = client.get(f"/api/questions/{pergunta.data['id']}/")
        self.assertEqual(detalhe.status_code, 200)
        self.assertEqual(len(detalhe.data["choices"]), 1)
        self.assertTrue(detalhe.data["choices"][0]["is_correct"])

        # alternativa apagável pelo endpoint próprio
        self.assertEqual(
            client.delete(f"/api/choices/{alternativa.data['id']}/").status_code, 204
        )

    def test_pergunta_duplicada_e_permitida_mas_nome_de_chefe_nao(self):
        # mesmo texto pode se repetir (requisito: 5 perguntas/arguição)
        boss = Boss.objects.create(name="Único")
        client = staff_client()
        for _ in range(2):
            resp = client.post(
                "/api/questions/", {"boss": boss.id, "text": "Repetida"}, format="json"
            )
            self.assertEqual(resp.status_code, 201)

        dup = client.post("/api/bosses/", {"name": "Único"}, format="json")
        self.assertEqual(dup.status_code, 400)


class QuestionModelTests(TestCase):
    def test_str_trunca_texto(self):
        boss = Boss.objects.create(name="C")
        q = Question.objects.create(boss=boss, text="x" * 100)
        self.assertEqual(len(str(q)), 60)


class AnswerKeyHiddenTests(TestCase):
    """Gabarito (is_correct) só aparece para professor."""

    def setUp(self):
        boss = Boss.objects.create(name="Chefe Gabarito")
        self.pergunta = Question.objects.create(boss=boss, text="2+2?")
        self.certa = Choice.objects.create(question=self.pergunta, text="4", is_correct=True)
        Choice.objects.create(question=self.pergunta, text="5", is_correct=False)

    def test_visitante_e_aluno_nao_veem_is_correct(self):
        for client in (anon_client(), user_client()):
            lista = client.get("/api/choices/")
            self.assertTrue(all("is_correct" not in c for c in lista.data))
            nested = client.get(f"/api/questions/{self.pergunta.id}/")
            self.assertTrue(all("is_correct" not in c for c in nested.data["choices"]))

    def test_professor_ve_is_correct(self):
        resp = staff_client().get(f"/api/choices/{self.certa.id}/")
        self.assertTrue(resp.data["is_correct"])
        nested = staff_client().get(f"/api/questions/{self.pergunta.id}/")
        self.assertEqual(sorted(c["is_correct"] for c in nested.data["choices"]), [False, True])


def _ability(**kwargs):
    base = {"name": "Habilidade", "trigger": "TEMPO", "effect": "PENALTY", "value": 10}
    base.update(kwargs)
    return Ability(**base)


class BossAbilityEngineTests(SimpleTestCase):
    """Motor de habilidades — PURO, sem banco (ADR-017)."""

    def test_gatilho_qualquer_dispara_abaixo_do_corte(self):
        ab = _ability()
        self.assertTrue(boss_engine.affected(ab, {"tempo": 1}))
        self.assertTrue(boss_engine.affected(ab, {"tempo": -1}))
        self.assertFalse(boss_engine.affected(ab, {"tempo": 3}))

    def test_gatilho_observa_só_os_critérios_mapeados(self):
        tempo = _ability(trigger="TEMPO")
        # fora do critério "tempo", notas ruins não disparam
        self.assertFalse(boss_engine.affected(tempo, {"historico": 1, "paradigma": 1}))
        # Fundamentos observa Histórico E Paradigma (basta um abaixo)
        fund = _ability(trigger="FUNDAMENTOS")
        self.assertTrue(boss_engine.affected(fund, {"historico": 3, "paradigma": 1}))
        self.assertFalse(boss_engine.affected(fund, {"historico": 3, "paradigma": 3}))

    def test_average_dispara_com_media_abaixa(self):
        ab = _ability(trigger="GERAL", mode=boss_engine.MODE_AVERAGE, threshold=1)
        low = {
            "tempo": 1, "historico": 1, "paradigma": -1, "caracteristicas": 1,
            "usos": -1, "codigo": 1, "criatividade": -1,
        }
        high = dict.fromkeys(boss_engine.CRITERIA_KEYS, 3)
        self.assertTrue(boss_engine.affected(ab, low))
        self.assertFalse(boss_engine.affected(ab, high))

    def test_spread_detecta_notas_variadas(self):
        ab = _ability(trigger="GERAL", mode=boss_engine.MODE_SPREAD, threshold=2)
        varied = dict.fromkeys(boss_engine.CRITERIA_KEYS, 3)
        varied["paradigma"] = 1  # variação de 2 níveis
        flat = dict.fromkeys(boss_engine.CRITERIA_KEYS, 3)
        self.assertTrue(boss_engine.affected(ab, varied))
        self.assertFalse(boss_engine.affected(ab, flat))

    def test_escopo_equipe_só_na_equipe_registrada(self):
        ab = _ability(scope=boss_engine.SCOPE_TEAM)
        self.assertTrue(boss_engine.fires_for_team(ab, {"tempo": 1}))
        self.assertFalse(boss_engine.fires_for_alliance(ab, {"tempo": 1}, 9))

    def test_escopo_alianca_exige_mínimo_de_equipes_afetadas(self):
        ab = _ability(scope=boss_engine.SCOPE_ALLIANCE, min_count=2)
        bad = {"tempo": 1}
        good = {"tempo": 3}
        self.assertFalse(boss_engine.fires_for_team(ab, bad))
        self.assertFalse(boss_engine.fires_for_alliance(ab, bad, affected_count=1))
        self.assertTrue(boss_engine.fires_for_alliance(ab, bad, affected_count=2))
        # equipe não afetada não recebe o efeito mesmo com contagem alta
        self.assertFalse(boss_engine.fires_for_alliance(ab, good, affected_count=5))

    def test_perguntas_dispara_a_cada_n_erros(self):
        ab = _ability(trigger="PERGUNTAS", every=2)
        self.assertFalse(boss_engine.fires_for_questions(ab, 0))
        self.assertFalse(boss_engine.fires_for_questions(ab, 1))
        self.assertTrue(boss_engine.fires_for_questions(ab, 2))
        self.assertFalse(boss_engine.fires_for_questions(ab, 3))
        self.assertTrue(boss_engine.fires_for_questions(ab, 4))

    def test_gatilhos_sem_critério_nunca_disparam(self):
        notas_ruins = dict.fromkeys(boss_engine.CRITERIA_KEYS, -1)
        for trigger in ("SUPORTE", "PERGUNTAS"):
            self.assertFalse(boss_engine.affected(_ability(trigger=trigger), notas_ruins))

    def test_pr_cost_é_informativo_não_executável(self):
        self.assertFalse(
            boss_engine.is_executable(_ability(effect=boss_engine.EFFECT_PR_COST))
        )
        for effect in (
            boss_engine.EFFECT_PENALTY, boss_engine.EFFECT_HEAL,
            boss_engine.EFFECT_DRAIN, boss_engine.EFFECT_CUT,
            boss_engine.EFFECT_DISADV,
        ):
            self.assertTrue(boss_engine.is_executable(_ability(effect=effect)))

    def test_from_model_converte_a_linha_patito(self):
        class Linha:
            name = "Olhar"
            trigger = "TEMPO"
            effect = "PENALTY"
            value = 10
            every = 2
            threshold = 2
            mode = "AVERAGE"
            scope = "ALLIANCE"
            min_count = 3
            description = "texto"

        ab = Ability.from_model(Linha())
        self.assertEqual(ab.name, "Olhar")
        self.assertEqual(ab.every, 2)
        self.assertEqual(ab.mode, "AVERAGE")
        self.assertEqual(ab.scope, "ALLIANCE")
        self.assertEqual(ab.min_count, 3)
        self.assertEqual(ab.description, "texto")


class BossAbilityModelTests(TestCase):
    """Modelo BossAbility (persistência das habilidades executáveis)."""

    def setUp(self):
        self.boss = Boss.objects.create(name="Chefe Teste", max_hp=100)

    def test_str_mostra_chefe_e_habilidade(self):
        ab = BossAbility.objects.create(
            boss=self.boss, name="Olhar", trigger="TEMPO", effect="PENALTY", value=10
        )
        self.assertIn("Chefe Teste", str(ab))
        self.assertIn("Olhar", str(ab))

    def test_nome_único_por_chefe(self):
        BossAbility.objects.create(boss=self.boss, name="Olhar")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                BossAbility.objects.create(boss=self.boss, name="Olhar")

    def test_mesmo_nome_em_chefes_diferentes_ok(self):
        BossAbility.objects.create(boss=self.boss, name="Olhar")
        outro = Boss.objects.create(name="Outro Chefe")
        BossAbility.objects.create(boss=outro, name="Olhar")
        self.assertEqual(BossAbility.objects.count(), 2)


class SeedChefesTests(TestCase):
    """`seed_chefes` espelha os 7 chefes da landing (idempotente)."""

    def test_seed_cria_sete_chefes_com_habilidades(self):
        call_command("seed_chefes")
        self.assertEqual(Boss.objects.count(), 7)
        self.assertEqual(BossAbility.objects.count(), 21)
        mothman = Boss.objects.get(name="Mothman, o Sábio")
        self.assertEqual(mothman.max_hp, 150)
        self.assertEqual(mothman.abilities.count(), 3)
        mago = Boss.objects.get(name="O Mago Corrompido")
        self.assertEqual(mago.max_hp, 200)
        self.assertFalse(mago.is_active)

    def test_seed_é_idempotente(self):
        call_command("seed_chefes")
        call_command("seed_chefes")
        self.assertEqual(Boss.objects.count(), 7)
        self.assertEqual(BossAbility.objects.count(), 21)

    def test_seed_renomeia_a_demo_antiga(self):
        Boss.objects.create(name="Mothman", max_hp=130)
        Boss.objects.create(name="O Rei Rato", max_hp=150)
        call_command("seed_chefes")
        self.assertFalse(Boss.objects.filter(name="Mothman").exists())
        self.assertFalse(Boss.objects.filter(name="O Rei Rato").exists())
        self.assertEqual(Boss.objects.count(), 7)

    def test_seed_preserva_habilidade_customizada(self):
        call_command("seed_chefes")
        boss = Boss.objects.get(name="Leshy")
        BossAbility.objects.create(
            boss=boss, name="Habilidade do Professor", trigger="GERAL",
            effect="HEAL", value=99,
        )
        call_command("seed_chefes")
        self.assertTrue(
            BossAbility.objects.filter(
                boss=boss, name="Habilidade do Professor"
            ).exists()
        )
        self.assertEqual(BossAbility.objects.count(), 22)
