from django.test import TestCase

from apps.bosses.models import Boss
from apps.groups.models import Group
from apps.test_helpers import anon_client, staff_client, user_client

from .models import (
    BattleEvent,
    GroupJourney,
    Journey,
    Stage,
    StageProgress,
)


class JourneyApiTests(TestCase):
    """CRUD de jornadas e etapas (as 8 incursões viram etapas)."""

    def test_listagem_publica(self):
        Journey.objects.create(name="Jornada do Tesouro")
        resp = anon_client().get("/api/journeys/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data[0]["name"], "Jornada do Tesouro")

    def test_visitante_nao_escreve(self):
        resp = anon_client().post("/api/journeys/", {"name": "X"}, format="json")
        self.assertIn(resp.status_code, (401, 403))

    def test_aluno_logado_nao_escreve(self):
        resp = user_client().post("/api/journeys/", {"name": "X"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_ciclo_completo_do_professor(self):
        client = staff_client()
        criado = client.post(
            "/api/journeys/", {"name": "Campanha 2026.2"}, format="json"
        )
        self.assertEqual(criado.status_code, 201)

        url = f"/api/journeys/{criado.data['id']}/"
        alterado = client.patch(url, {"is_active": False}, format="json")
        self.assertEqual(alterado.status_code, 200)
        self.assertFalse(alterado.data["is_active"])

        self.assertEqual(client.delete(url).status_code, 204)
        self.assertFalse(Journey.objects.exists())


class StageApiTests(TestCase):
    """Etapas: ordem única DENTRO da jornada (UniqueTogetherValidator)."""

    def setUp(self):
        self.client_api = staff_client()
        self.jornada = Journey.objects.create(name="J-A")
        self.outra = Journey.objects.create(name="J-B")
        # boss_pool é obrigatório e não-vazio (model sem blank=True) — sem
        # pool a etapa não sorteia chefe.
        self.chefe = Boss.objects.create(name="Chefe do Pool")

    def _post_stage(self, journey, order, name="Etapa"):
        return self.client_api.post(
            "/api/stages/",
            {
                "journey": journey.id,
                "order": order,
                "name": name,
                "boss_pool": [self.chefe.id],
            },
            format="json",
        )

    def test_cria_etapa_e_mostra_journey_name(self):
        resp = self._post_stage(self.jornada, 1, "Incursão 1")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["journey_name"], "J-A")

    def test_ordem_duplicada_na_mesma_jornada_rejeitada(self):
        self._post_stage(self.jornada, 1)
        dup = self._post_stage(self.jornada, 1)
        self.assertEqual(dup.status_code, 400)
        self.assertIn("ordem", str(dup.data).lower())

    def test_mesma_ordem_em_jornada_diferente_e_permitida(self):
        self._post_stage(self.jornada, 1)
        outra = self._post_stage(self.outra, 1)
        self.assertEqual(outra.status_code, 201)

    def test_listagem_publica_ordenada(self):
        Stage.objects.create(journey=self.jornada, order=2, name="2")
        Stage.objects.create(journey=self.jornada, order=1, name="1")
        resp = anon_client().get("/api/stages/")
        self.assertEqual([s["order"] for s in resp.data], [1, 2])


class GroupJourneyApiTests(TestCase):
    """Vínculo grupo ↔ jornada (único por par)."""

    def setUp(self):
        self.client_api = staff_client()
        self.grupo = Group.objects.create(name="Equipe A")
        self.jornada = Journey.objects.create(name="Jornada X")

    def test_ciclo_completo_com_total_score(self):
        resp = self.client_api.post(
            "/api/group-journeys/",
            {"group": self.grupo.id, "journey": self.jornada.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["total_score"], 0)
        self.assertEqual(resp.data["group_name"], "Equipe A")
        self.assertEqual(resp.data["status"], "PROG")

        url = f"/api/group-journeys/{resp.data['id']}/"
        alterado = self.client_api.patch(
            url, {"status": "DONE"}, format="json"
        )
        self.assertEqual(alterado.status_code, 200)
        self.assertEqual(alterado.data["status"], "DONE")
        self.assertEqual(self.client_api.delete(url).status_code, 204)

    def test_vinculo_duplicado_rejeitado(self):
        payload = {"group": self.grupo.id, "journey": self.jornada.id}
        self.assertEqual(
            self.client_api.post(
                "/api/group-journeys/", payload, format="json"
            ).status_code,
            201,
        )
        dup = self.client_api.post(
            "/api/group-journeys/", payload, format="json"
        )
        self.assertEqual(dup.status_code, 400)


class StageProgressApiTests(TestCase):
    """Progresso de batalha de um grupo numa etapa (precisa de chefe)."""

    def setUp(self):
        self.client_api = staff_client()
        self.grupo = Group.objects.create(name="Equipe B")
        self.jornada = Journey.objects.create(name="Jornada Y")
        self.etapa = Stage.objects.create(journey=self.jornada, order=1, name="E1")
        self.chefe = Boss.objects.create(name="Chefe", max_hp=150)
        self.corrida = GroupJourney.objects.create(
            group=self.grupo, journey=self.jornada
        )

    def test_ciclo_completo_com_hp_herda_do_combatant(self):
        resp = self.client_api.post(
            "/api/stage-progress/",
            {
                "group_journey": self.corrida.id,
                "stage": self.etapa.id,
                "boss": self.chefe.id,
                "hp": 150,
                "shield": 10,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["max_hp"], 100)  # default do Combatant
        self.assertEqual(resp.data["hp"], 150)
        self.assertEqual(resp.data["shield"], 10)
        self.assertEqual(resp.data["stage_name"], "Jornada Y #1 - E1")

        url = f"/api/stage-progress/{resp.data['id']}/"
        alterado = self.client_api.patch(url, {"score": 42}, format="json")
        self.assertEqual(alterado.status_code, 200)
        self.assertEqual(alterado.data["score"], 42)
        self.assertEqual(self.client_api.delete(url).status_code, 204)

    def test_progresso_duplicado_rejeitado(self):
        payload = {
            "group_journey": self.corrida.id,
            "stage": self.etapa.id,
            "boss": self.chefe.id,
        }
        self.assertEqual(
            self.client_api.post(
                "/api/stage-progress/", payload, format="json"
            ).status_code,
            201,
        )
        dup = self.client_api.post(
            "/api/stage-progress/", payload, format="json"
        )
        self.assertEqual(dup.status_code, 400)


class BattleEventApiTests(TestCase):
    """Log de batalha: cria, mas NÃO edita nem apaga (append-only)."""

    def setUp(self):
        self.client_api = staff_client()
        self.grupo = Group.objects.create(name="Equipe C")
        self.jornada = Journey.objects.create(name="Jornada Z")
        self.etapa = Stage.objects.create(journey=self.jornada, order=1, name="E1")
        self.chefe = Boss.objects.create(name="Chefe Z")
        self.corrida = GroupJourney.objects.create(
            group=self.grupo, journey=self.jornada
        )
        self.progresso = StageProgress.objects.create(
            group_journey=self.corrida, stage=self.etapa, boss=self.chefe
        )

    def _evento(self):
        return BattleEvent.objects.create(
            progress=self.progresso, turn=1, actor=BattleEvent.Actor.BOSS, value=7
        )

    def test_listagem_publica_e_criacao_do_professor(self):
        self._evento()
        self.assertEqual(anon_client().get("/api/battle-events/").status_code, 200)

        resp = self.client_api.post(
            "/api/battle-events/",
            {
                "progress": self.progresso.id,
                "turn": 2,
                "actor": "STU",
                "value": 10,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(BattleEvent.objects.count(), 2)

    def test_log_e_imutavel_put_e_delete_negados(self):
        evento = self._evento()
        url = f"/api/battle-events/{evento.id}/"

        put = self.client_api.put(url, {"turn": 99}, format="json")
        self.assertEqual(put.status_code, 405)

        delete = self.client_api.delete(url)
        self.assertEqual(delete.status_code, 405)
        self.assertTrue(BattleEvent.objects.filter(pk=evento.pk).exists())

    def test_visitante_nao_escreve(self):
        resp = anon_client().post(
            "/api/battle-events/", {"turn": 1, "actor": "STU"}, format="json"
        )
        self.assertIn(resp.status_code, (401, 403))
