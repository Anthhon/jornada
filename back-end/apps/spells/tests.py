from django.test import TestCase

from apps.test_helpers import anon_client, staff_client, user_client

from .models import Spell


class SpellApiTests(TestCase):
    """CRUD de feitiços/habilidades."""

    def test_listagem_publica(self):
        Spell.objects.create(name="Bola de Fogo", spell_type=Spell.SpellType.DAMAGE)
        resp = anon_client().get("/api/spells/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data[0]["spell_type"], "DMGE")

    def test_visitante_nao_escreve(self):
        resp = anon_client().post("/api/spells/", {"name": "X"}, format="json")
        self.assertIn(resp.status_code, (401, 403))

    def test_aluno_logado_nao_escreve(self):
        resp = user_client().post("/api/spells/", {"name": "X"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_ciclo_completo_do_professor(self):
        client = staff_client()
        criado = client.post(
            "/api/spells/",
            {
                "name": "Escudo Radiante",
                "spell_type": Spell.SpellType.SHIELD,
                "base_value": 5,
                "cooldown_turns": 2,
            },
            format="json",
        )
        self.assertEqual(criado.status_code, 201)
        self.assertEqual(criado.data["base_value"], 5)

        url = f"/api/spells/{criado.data['id']}/"
        alterado = client.patch(url, {"is_active": False}, format="json")
        self.assertEqual(alterado.status_code, 200)
        self.assertFalse(alterado.data["is_active"])

        self.assertEqual(client.delete(url).status_code, 204)
        self.assertFalse(Spell.objects.exists())

    def test_nome_duplicado_rejeitado(self):
        Spell.objects.create(name="Único")
        resp = staff_client().post("/api/spells/", {"name": "Único"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_tipo_invalido_rejeitado(self):
        resp = staff_client().post(
            "/api/spells/", {"name": "Errado", "spell_type": "XXXX"}, format="json"
        )
        self.assertEqual(resp.status_code, 400)
