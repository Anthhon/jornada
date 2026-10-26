from django.test import TestCase

from apps.test_helpers import anon_client, staff_client, user_client

from .models import Group


class GroupApiTests(TestCase):
    """CRUD de equipes: leitura pública, escrita só professor."""

    def test_listagem_publica_com_member_count(self):
        Group.objects.create(name="Equipe Alfa")
        resp = anon_client().get("/api/groups/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["member_count"], 0)

    def test_visitante_nao_escreve(self):
        resp = anon_client().post("/api/groups/", {"name": "Novo"}, format="json")
        self.assertIn(resp.status_code, (401, 403))

    def test_aluno_logado_nao_escreve(self):
        resp = user_client().post("/api/groups/", {"name": "Novo"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_ciclo_completo_do_professor(self):
        client = staff_client()
        criado = client.post(
            "/api/groups/", {"name": "Equipe Beta", "points": 10}, format="json"
        )
        self.assertEqual(criado.status_code, 201)
        self.assertEqual(criado.data["points"], 10)
        self.assertEqual(criado.data["member_count"], 0)

        url = f"/api/groups/{criado.data['id']}/"
        self.assertEqual(client.get(url).status_code, 200)

        alterado = client.patch(url, {"points": 15}, format="json")
        self.assertEqual(alterado.status_code, 200)
        self.assertEqual(alterado.data["points"], 15)

        self.assertEqual(client.delete(url).status_code, 204)
        self.assertFalse(Group.objects.filter(name="Equipe Beta").exists())

    def test_nome_duplicado_rejeitado(self):
        Group.objects.create(name="Duplicado")
        resp = staff_client().post(
            "/api/groups/", {"name": "Duplicado"}, format="json"
        )
        self.assertEqual(resp.status_code, 400)


class LeaderboardApiTests(TestCase):
    """GET /api/leaderboard/ — placar público (épico da Lista 1-2)."""

    def setUp(self):
        # Ordem por pontos (Zeta 40 primeiro) DIFERE da ordem alfabética
        # (Alfa primeiro) — assim o teste pega ordenação trocada. Empate entre
        # Alfa e Mike (30) quebra por nome: Alfa antes de Mike.
        Group.objects.create(name="Alfa", points=30)
        Group.objects.create(name="Mike", points=30)
        Group.objects.create(name="Zeta", points=40)

    def test_publico_sem_login(self):
        resp = anon_client().get("/api/leaderboard/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 3)

    def test_ordena_por_pontos_com_empate_alfabetico(self):
        resp = anon_client().get("/api/leaderboard/")
        self.assertEqual(
            [(e["position"], e["name"], e["points"]) for e in resp.data],
            [(1, "Zeta", 40), (2, "Alfa", 30), (3, "Mike", 30)],
        )

    def test_entrada_carrega_member_count_e_sem_created_at(self):
        entrada = anon_client().get("/api/leaderboard/").data[0]
        self.assertIn("member_count", entrada)
        self.assertNotIn("created_at", entrada)
        self.assertEqual(entrada["member_count"], 0)

    def test_aluno_logado_tambem_le(self):
        self.assertEqual(
            user_client().get("/api/leaderboard/").status_code, 200
        )

    def test_escrita_negada(self):
        # visitante: 401/403 (permissão); professor: rota só tem GET → 405
        anon = anon_client().post("/api/leaderboard/", {}, format="json")
        self.assertIn(anon.status_code, (401, 403))
        staff = staff_client().post("/api/leaderboard/", {}, format="json")
        self.assertEqual(staff.status_code, 405)
