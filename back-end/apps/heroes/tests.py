from django.test import TestCase

from apps.groups.models import Group
from apps.spells.models import Spell
from apps.test_helpers import anon_client, staff_client, user_client

from .models import Hero


class HeroApiTests(TestCase):
    """CRUD de heróis: 1 por equipe (OneToOne) + feitiços equipados."""

    def setUp(self):
        self.grupo = Group.objects.create(name="Guerreiros")
        self.outro_grupo = Group.objects.create(name="Magos")
        self.bola = Spell.objects.create(name="Bola de Fogo", base_value=7)
        self.cura = Spell.objects.create(name="Cura", spell_type=Spell.SpellType.HEAL)

    def test_listagem_publica_com_nomes(self):
        heroi = Hero.objects.create(name="Kovu", group=self.grupo)
        heroi.spells.set([self.bola])  # M2M não entra no create()
        resp = anon_client().get("/api/heroes/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data[0]["group_name"], "Guerreiros")
        self.assertEqual(resp.data[0]["spell_names"], ["Bola de Fogo"])

    def test_visitante_nao_escreve(self):
        resp = anon_client().post("/api/heroes/", {"name": "X"}, format="json")
        self.assertIn(resp.status_code, (401, 403))

    def test_aluno_logado_nao_escreve(self):
        resp = user_client().post("/api/heroes/", {"name": "X"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_ciclo_completo_do_professor(self):
        client = staff_client()
        criado = client.post(
            "/api/heroes/",
            {
                "name": "Emy",
                "group": self.outro_grupo.id,
                "spells": [self.bola.id, self.cura.id],
                "power_bonus": 2,
            },
            format="json",
        )
        self.assertEqual(criado.status_code, 201)
        self.assertEqual(criado.data["group_name"], "Magos")
        self.assertEqual(criado.data["spell_names"], ["Bola de Fogo", "Cura"])

        url = f"/api/heroes/{criado.data['id']}/"
        alterado = client.patch(url, {"spells": [self.cura.id]}, format="json")
        self.assertEqual(alterado.status_code, 200)
        self.assertEqual(alterado.data["spell_names"], ["Cura"])

        self.assertEqual(client.delete(url).status_code, 204)
        self.assertFalse(Hero.objects.exists())

    def test_dois_herois_na_mesma_equipe_rejeitado(self):
        Hero.objects.create(name="Primeiro", group=self.grupo)
        resp = staff_client().post(
            "/api/heroes/", {"name": "Segundo", "group": self.grupo.id}, format="json"
        )
        self.assertEqual(resp.status_code, 400)
