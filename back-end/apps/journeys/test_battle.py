"""Testes do motor de batalha (regras + endpoints /api/battle/)."""

from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from apps.bosses.models import Boss, BossSpell, Choice, Question
from apps.groups.models import Group
from apps.heroes.models import Hero
from apps.spells.models import Spell
from apps.test_helpers import anon_client, staff_client
from apps.users.models import Student

from . import battle
from .models import BattleEvent, GroupJourney, Journey, Stage, StageProgress


def make_question(boss, points=10, n_wrong=2):
    q = Question.objects.create(boss=boss, text=f"Pergunta {boss.name} {points}", points=points)
    Choice.objects.create(question=q, text="certa", is_correct=True)
    for i in range(n_wrong):
        Choice.objects.create(question=q, text=f"errada {i}", is_correct=False)
    return q


def right(question_id):
    return Choice.objects.get(question_id=question_id, is_correct=True).id


def wrong(question_id):
    return Choice.objects.filter(question_id=question_id, is_correct=False).first().id


class BattleBase(TestCase):
    """Jornada de 2 etapas; chefe A (30 HP) na etapa 1, chefe B (10 HP) na 2."""

    def setUp(self):
        self.prof = staff_client()
        self.grupo = Group.objects.create(name="Alfa")
        self.outro_grupo = Group.objects.create(name="Beta")
        self.jornada = Journey.objects.create(name="Campanha")

        self.mordida = Spell.objects.create(
            name="Mordida", spell_type=Spell.SpellType.DAMAGE, base_value=5
        )
        self.chefe_a = Boss.objects.create(name="Chefe A", max_hp=30)
        self.chefe_b = Boss.objects.create(name="Chefe B", max_hp=10)
        BossSpell.objects.create(boss=self.chefe_a, spell=self.mordida)
        for boss in (self.chefe_a, self.chefe_b):
            for _ in range(3):
                make_question(boss)

        self.etapa1 = Stage.objects.create(journey=self.jornada, order=1, name="E1", max_score=100)
        self.etapa1.boss_pool.set([self.chefe_a])
        self.etapa2 = Stage.objects.create(journey=self.jornada, order=2, name="E2", max_score=50)
        self.etapa2.boss_pool.set([self.chefe_b])

        self.fogo = Spell.objects.create(
            name="Fogo", spell_type=Spell.SpellType.DAMAGE, base_value=7, cooldown_turns=2
        )
        self.cura = Spell.objects.create(
            name="Cura", spell_type=Spell.SpellType.HEAL, base_value=20
        )
        self.escudo = Spell.objects.create(
            name="Escudo", spell_type=Spell.SpellType.SHIELD, base_value=15
        )
        self.heroi = Hero.objects.create(
            name="Kovu", group=self.grupo, journey=self.jornada, max_hp=100, hp=100,
            power_bonus=3,
        )
        self.heroi.spells.set([self.fogo, self.cura, self.escudo])
        self.corrida = GroupJourney.objects.create(group=self.grupo, journey=self.jornada)

    def start(self, client=None):
        resp = (client or self.prof).post(
            "/api/battle/start/", {"group_journey": self.corrida.id}, format="json"
        )
        return resp

    def answer(self, progress_id, choice, client=None, **extra):
        return (client or self.prof).post(
            f"/api/battle/{progress_id}/answer/", {"choice": choice, **extra}, format="json"
        )


class StartBattleTests(BattleBase):
    def test_start_sorteia_chefe_da_etapa_1_e_nao_vaza_gabarito(self):
        resp = self.start()
        self.assertEqual(resp.status_code, 201, resp.data)
        data = resp.data
        self.assertEqual(data["stage"]["order"], 1)
        self.assertEqual(data["boss"]["name"], "Chefe A")
        self.assertEqual((data["boss"]["hp"], data["boss"]["max_hp"]), (30, 30))
        self.assertEqual((data["hero"]["hp"], data["hero"]["max_hp"]), (100, 100))
        self.assertEqual(data["status"], "PROG")
        self.assertIsNotNone(data["question"])
        for choice in data["question"]["choices"]:
            self.assertNotIn("is_correct", choice)
        self.corrida.refresh_from_db()
        self.assertEqual(self.corrida.current_stage_id, self.etapa1.id)

    def test_estado_e_publico(self):
        progress_id = self.start().data["id"]
        resp = anon_client().get(f"/api/battle/{progress_id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["boss"]["name"], "Chefe A")

    def test_nao_abre_segunda_batalha_em_andamento(self):
        self.assertEqual(self.start().status_code, 201)
        resp = self.start()
        self.assertEqual(resp.status_code, 400)
        self.assertIn("andamento", str(resp.data))

    def test_etapa_fora_de_ordem_rejeitada(self):
        resp = self.prof.post(
            "/api/battle/start/",
            {"group_journey": self.corrida.id, "stage": self.etapa2.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_sem_heroi_rejeitado(self):
        self.heroi.delete()
        resp = self.start()
        self.assertEqual(resp.status_code, 400)
        self.assertIn("herói", str(resp.data))

    def test_heroi_de_outra_jornada_nao_vale(self):
        outra = Journey.objects.create(name="Outra")
        self.heroi.journey = outra
        self.heroi.save()
        self.assertEqual(self.start().status_code, 400)

    def test_chefe_sem_perguntas_validas_rejeitado(self):
        Question.objects.filter(boss=self.chefe_a).delete()
        resp = self.start()
        self.assertEqual(resp.status_code, 400)
        self.assertIn("chefe jogável", str(resp.data))

    def test_pergunta_sem_alternativa_correta_nao_e_sorteada(self):
        Question.objects.filter(boss=self.chefe_a).delete()
        q = Question.objects.create(boss=self.chefe_a, text="quebrada")
        Choice.objects.create(question=q, text="a")
        Choice.objects.create(question=q, text="b")
        self.assertEqual(self.start().status_code, 400)

    def test_sorteio_usa_apenas_chefes_ativos_do_pool(self):
        extra = Boss.objects.create(name="Chefe Extra")
        make_question(extra)
        inativo = Boss.objects.create(name="Chefe Inativo", is_active=False)
        make_question(inativo)
        self.etapa1.boss_pool.set([self.chefe_a, extra, inativo])
        vistos = set()
        for seed in range(20):
            StageProgress.objects.all().delete()
            progress = battle.start_stage(self.corrida)
            vistos.add(progress.boss.name)
        self.assertEqual(vistos, {"Chefe A", "Chefe Extra"})

    def test_jornada_ja_concluida_nao_inicia(self):
        self.corrida.status = GroupJourney.Status.COMPLETED
        self.corrida.save()
        self.assertEqual(self.start().status_code, 400)


class StartPermissionTests(BattleBase):
    def _client_aluno(self, grupo, username, active=True):
        user = User.objects.create_user(username=username, password="x")
        Student.objects.create(name=username, user=user, group=grupo, is_active=active)
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_visitante_nao_joga(self):
        resp = anon_client().post(
            "/api/battle/start/", {"group_journey": self.corrida.id}, format="json"
        )
        self.assertEqual(resp.status_code, 401)

    def test_aluno_de_outro_grupo_nao_joga(self):
        aluno = self._client_aluno(self.outro_grupo, "intruso")
        self.assertEqual(self.start(aluno).status_code, 403)

    def test_membro_do_grupo_joga_e_responde_como_ele_mesmo(self):
        aluno = self._client_aluno(self.grupo, "membro")
        resp = self.start(aluno)
        self.assertEqual(resp.status_code, 201)
        q = resp.data["question"]["id"]
        out = self.answer(resp.data["id"], right(q), client=aluno)
        self.assertEqual(out.status_code, 200)
        evento = BattleEvent.objects.filter(question_id=q).first()
        self.assertEqual(evento.student.name, "membro")

    def test_aluno_desativado_nao_joga(self):
        aluno = self._client_aluno(self.grupo, "inativo", active=False)
        self.assertEqual(self.start(aluno).status_code, 403)


class AnswerTests(BattleBase):
    def setUp(self):
        super().setUp()
        self.progress_id = self.start().data["id"]

    def current_question(self):
        return StageProgress.objects.get(pk=self.progress_id).current_question

    def test_acerto_causa_dano_pontua_e_chefe_revida(self):
        q = self.current_question()
        resp = self.answer(self.progress_id, right(q.id))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["correct"])
        state = resp.data["state"]
        self.assertEqual(state["boss"]["hp"], 20)  # 30 - 10 (pontos da pergunta)
        self.assertEqual(state["hero"]["hp"], 95)  # mordida do chefe: 5
        self.assertEqual(state["score"], 10)
        self.assertEqual(state["turn"], 1)
        eventos = list(BattleEvent.objects.filter(progress_id=self.progress_id))
        self.assertEqual(
            [(e.actor, e.value) for e in eventos], [("STU", 10), ("BOS", 5)]
        )
        self.assertTrue(eventos[0].answered_correctly)

    def test_erro_nao_causa_dano_nem_pontos_mas_chefe_ataca(self):
        q = self.current_question()
        resp = self.answer(self.progress_id, wrong(q.id))
        self.assertFalse(resp.data["correct"])
        state = resp.data["state"]
        self.assertEqual(state["boss"]["hp"], 30)
        self.assertEqual(state["hero"]["hp"], 95)
        self.assertEqual(state["score"], 0)

    def test_feitico_de_dano_soma_bonus_do_heroi(self):
        q = self.current_question()
        resp = self.answer(self.progress_id, right(q.id), spell=self.fogo.id)
        # 10 da pergunta + (7 base + 3 bônus do herói) do feitiço = 20 → 10 HP
        self.assertEqual(resp.data["state"]["boss"]["hp"], 10)
        spell_event = BattleEvent.objects.get(progress_id=self.progress_id, spell=self.fogo)
        self.assertEqual(spell_event.value, 10)

    def test_feitico_nao_conta_se_errou(self):
        q = self.current_question()
        resp = self.answer(self.progress_id, wrong(q.id), spell=self.fogo.id)
        self.assertEqual(resp.data["state"]["boss"]["hp"], 30)
        self.assertFalse(BattleEvent.objects.filter(spell=self.fogo).exists())

    def test_cura_vai_no_heroi_e_nao_passa_do_maximo(self):
        q = self.current_question()
        # herói começa em 100/100; chefe revida 5 → 95; cura de 20 (+3) limita em 100
        resp = self.answer(self.progress_id, right(q.id), spell=self.cura.id)
        self.assertEqual(resp.data["state"]["hero"]["hp"], 95)  # curou 0 antes do revide
        ev = BattleEvent.objects.get(progress_id=self.progress_id, spell=self.cura)
        self.assertEqual(ev.value, 0)

    def test_escudo_absorve_o_revide_do_chefe(self):
        q = self.current_question()
        resp = self.answer(self.progress_id, right(q.id), spell=self.escudo.id)
        state = resp.data["state"]
        # escudo 15+3=18; mordida 5 absorvida → HP intacto, escudo 13
        self.assertEqual(state["hero"]["hp"], 100)
        self.assertEqual(state["hero"]["shield"], 13)

    def test_recarga_do_feitico(self):
        # herói forte e chefe sem feitiços: luta longa e previsível
        self.heroi.max_hp = 1000
        self.heroi.save()
        StageProgress.objects.all().delete()
        self.chefe_a.max_hp = 1000
        self.chefe_a.save()
        BossSpell.objects.all().delete()
        pid = self.start().data["id"]

        def go(spell=None):
            q = StageProgress.objects.get(pk=pid).current_question
            return self.answer(pid, wrong(q.id), spell=spell)

        # errar não consome recarga → feitiço só entra com acerto
        q = StageProgress.objects.get(pk=pid).current_question
        self.assertEqual(self.answer(pid, right(q.id), spell=self.fogo.id).status_code, 200)  # t1
        self.assertEqual(go(self.fogo.id).status_code, 400)  # t2 em recarga (2)
        self.assertEqual(go().status_code, 200)               # t2 sem feitiço
        self.assertEqual(go(self.fogo.id).status_code, 400)  # t3 ainda (1)
        self.assertEqual(go().status_code, 200)               # t3
        self.assertEqual(go(self.fogo.id).status_code, 200)  # t4 liberado

    def test_estado_mostra_recarga(self):
        q = self.current_question()
        self.answer(self.progress_id, right(q.id), spell=self.fogo.id)
        state = self.prof.get(f"/api/battle/{self.progress_id}/").data
        fogo = next(s for s in state["spells"] if s["name"] == "Fogo")
        self.assertFalse(fogo["ready"])
        self.assertEqual(fogo["cooldown_left"], 2)

    def test_feitico_que_o_heroi_nao_tem_rejeitado(self):
        estranho = Spell.objects.create(name="Raio", spell_type=Spell.SpellType.DAMAGE, base_value=9)
        q = self.current_question()
        resp = self.answer(self.progress_id, right(q.id), spell=estranho.id)
        self.assertEqual(resp.status_code, 400)

    def test_alternativa_de_outra_pergunta_rejeitada(self):
        q = self.current_question()
        outra = Question.objects.exclude(pk=q.pk).first()
        resp = self.answer(self.progress_id, right(outra.id))
        self.assertEqual(resp.status_code, 400)

    def test_estudante_de_outro_grupo_rejeitado(self):
        intruso = Student.objects.create(name="Intruso", group=self.outro_grupo)
        q = self.current_question()
        resp = self.answer(self.progress_id, right(q.id), student=intruso.id)
        self.assertEqual(resp.status_code, 400)

    def test_perguntas_nao_repetem_ate_esgotar(self):
        BossSpell.objects.all().delete()  # chefe inofensivo
        self.chefe_a.max_hp = 10_000
        self.chefe_a.save()
        StageProgress.objects.all().delete()
        pid = self.start().data["id"]
        vistas = []
        for _ in range(3):
            q = StageProgress.objects.get(pk=pid).current_question
            vistas.append(q.id)
            self.answer(pid, wrong(q.id))
        self.assertEqual(len(set(vistas)), 3)


class OutcomeTests(BattleBase):
    def fight_until_end(self, pid, correct=True):
        for _ in range(200):
            progress = StageProgress.objects.get(pk=pid)
            if progress.status != StageProgress.Status.IN_PROGRESS:
                return progress
            q = progress.current_question
            self.answer(pid, right(q.id) if correct else wrong(q.id))
        self.fail("batalha não terminou")

    def test_vitoria_credita_pontos_e_avanca_de_etapa(self):
        pid = self.start().data["id"]
        progress = self.fight_until_end(pid)
        self.assertEqual(progress.status, "DONE")
        self.assertIsNotNone(progress.finished_at)
        self.assertEqual(progress.score, 30)  # 3 acertos x 10
        self.grupo.refresh_from_db()
        self.assertEqual(self.grupo.points, 30)
        self.corrida.refresh_from_db()
        self.assertEqual(self.corrida.status, "PROG")
        self.assertEqual(self.corrida.current_stage_id, self.etapa2.id)
        self.assertIsNone(progress.current_question)

    def test_nao_responde_batalha_encerrada(self):
        pid = self.start().data["id"]
        self.fight_until_end(pid)
        resp = self.answer(pid, 1)
        self.assertEqual(resp.status_code, 400)

    def test_derrota_zera_pontos_ganhos_e_ainda_avanca(self):
        self.heroi.max_hp = 10
        self.heroi.save()
        pid = self.start().data["id"]
        progress = self.fight_until_end(pid, correct=False)
        self.assertEqual(progress.status, "FAIL")
        self.assertEqual(progress.hp, 0)
        self.grupo.refresh_from_db()
        self.assertEqual(self.grupo.points, 0)
        self.corrida.refresh_from_db()
        self.assertEqual(self.corrida.current_stage_id, self.etapa2.id)

    def test_derrota_response_flags(self):
        self.heroi.max_hp = 5
        self.heroi.save()
        pid = self.start().data["id"]
        q = StageProgress.objects.get(pk=pid).current_question
        resp = self.answer(pid, wrong(q.id))
        self.assertTrue(resp.data["finished"])
        self.assertFalse(resp.data["victory"])

    def test_pontuacao_limitada_ao_max_score_da_etapa(self):
        self.etapa1.max_score = 15
        self.etapa1.save()
        pid = self.start().data["id"]
        progress = self.fight_until_end(pid)
        self.assertEqual(progress.score, 15)
        self.grupo.refresh_from_db()
        self.assertEqual(self.grupo.points, 15)

    def test_estouro_de_turnos_e_derrota(self):
        BossSpell.objects.all().delete()
        self.chefe_a.max_hp = 10_000
        self.chefe_a.save()
        pid = self.start().data["id"]
        with mock.patch.object(battle, "MAX_TURNS", 3):
            progress = self.fight_until_end(pid, correct=False)
        self.assertEqual(progress.status, "FAIL")
        self.assertEqual(progress.turn, 3)

    def test_jornada_completa_gera_resumo_e_nota_sugerida(self):
        # etapa 1 (max 100): vence com 30; etapa 2 (max 50): vence com 10
        self.fight_until_end(self.start().data["id"])
        self.fight_until_end(self.start().data["id"])
        self.corrida.refresh_from_db()
        self.assertEqual(self.corrida.status, "DONE")
        self.assertIsNotNone(self.corrida.finished_at)
        self.assertIsNone(self.corrida.current_stage)
        self.grupo.refresh_from_db()
        self.assertEqual(self.grupo.points, 40)

        resumo = self.prof.get(f"/api/group-journeys/{self.corrida.id}/summary/")
        self.assertEqual(resumo.status_code, 200)
        self.assertEqual(resumo.data["total_score"], 40)
        self.assertEqual(resumo.data["max_score"], 150)
        self.assertEqual(str(resumo.data["suggested_grade"]), "2.67")
        self.assertEqual([s["status"] for s in resumo.data["stages"]], ["DONE", "DONE"])

        # terminou tudo: não abre mais etapa
        self.assertEqual(self.start().status_code, 400)

    def test_resumo_conta_acertos_por_aluno(self):
        ana = Student.objects.create(name="Ana", group=self.grupo)
        bia = Student.objects.create(name="Bia", group=self.grupo)
        pid = self.start().data["id"]
        q = StageProgress.objects.get(pk=pid).current_question
        self.answer(pid, right(q.id), student=ana.id)
        q = StageProgress.objects.get(pk=pid).current_question
        self.answer(pid, wrong(q.id), student=bia.id)
        resumo = self.prof.get(f"/api/group-journeys/{self.corrida.id}/summary/").data
        por_nome = {s["name"]: s for s in resumo["students"]}
        self.assertEqual((por_nome["Ana"]["correct"], por_nome["Ana"]["points"]), (1, 10))
        self.assertEqual((por_nome["Bia"]["answered"], por_nome["Bia"]["correct"]), (1, 0))


class CombatSideTests(TestCase):
    """O mesmo Spell.cast serve herói e chefe (interface única)."""

    def test_spell_cast_funciona_nos_dois_lados(self):
        grupo = Group.objects.create(name="G")
        jornada = Journey.objects.create(name="J")
        etapa = Stage.objects.create(journey=jornada, order=1, name="E")
        boss = Boss.objects.create(name="B", max_hp=50)
        gj = GroupJourney.objects.create(group=grupo, journey=jornada)
        progress = StageProgress.objects.create(
            group_journey=gj, stage=etapa, boss=boss,
            max_hp=40, hp=40, boss_max_hp=50, boss_hp=50,
        )
        golpe = Spell.objects.create(name="Golpe", spell_type=Spell.SpellType.DAMAGE, base_value=12)
        heroi, chefe = battle._Side(progress, ""), battle._Side(progress, "boss_")
        self.assertEqual(golpe.cast(chefe), 12)
        self.assertEqual(golpe.cast(heroi), 12)
        self.assertEqual((progress.hp, progress.boss_hp), (28, 38))
