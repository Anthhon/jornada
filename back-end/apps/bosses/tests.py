from django.test import TestCase

from apps.spells.models import Spell
from apps.test_helpers import anon_client, staff_client, user_client

from .models import Boss, BossSpell, Choice, Question


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
