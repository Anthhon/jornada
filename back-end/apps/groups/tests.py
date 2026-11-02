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


class GroupManagementTests(TestCase):
    """Facilitar a edição de grupos com N alunos + pontos extras."""

    def setUp(self):
        from apps.users.models import Student

        self.Student = Student
        self.grupo = Group.objects.create(name="Alfa")
        self.outro = Group.objects.create(name="Beta")
        self.ana = Student.objects.create(name="Ana", group=self.grupo)
        self.bia = Student.objects.create(name="Bia", group=self.grupo)
        self.caio = Student.objects.create(name="Caio", group=self.outro)
        self.davi = Student.objects.create(name="Davi")

    def test_set_members_substitui_a_lista_inteira(self):
        resp = staff_client().post(
            f"/api/groups/{self.grupo.id}/set-members/",
            {"students": [self.ana.id, self.caio.id, self.davi.id]},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["member_count"], 3)
        self.bia.refresh_from_db()
        self.assertIsNone(self.bia.group)  # saiu
        self.caio.refresh_from_db()
        self.assertEqual(self.caio.group_id, self.grupo.id)  # veio do outro grupo

    def test_set_members_com_id_inexistente_nao_muda_nada(self):
        resp = staff_client().post(
            f"/api/groups/{self.grupo.id}/set-members/",
            {"students": [self.ana.id, 9999]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.bia.refresh_from_db()
        self.assertEqual(self.bia.group_id, self.grupo.id)

    def test_set_members_so_professor(self):
        url = f"/api/groups/{self.grupo.id}/set-members/"
        self.assertIn(anon_client().post(url, {"students": []}, format="json").status_code, (401, 403))
        self.assertEqual(user_client().post(url, {"students": []}, format="json").status_code, 403)

    def test_pontos_extras_somam_e_entram_no_total(self):
        client = staff_client()
        url = f"/api/groups/{self.grupo.id}/add-extra-points/"
        client.post(url, {"amount": 5}, format="json")
        resp = client.post(url, {"amount": 3}, format="json")
        self.assertEqual(resp.data["extra_points"], 8)
        self.assertEqual(resp.data["total_points"], 8)
        desconto = client.post(url, {"amount": -2}, format="json")
        self.assertEqual(desconto.data["extra_points"], 6)

    def test_placar_ordena_por_total_e_oculta_inativos(self):
        self.grupo.points = 10
        self.grupo.extra_points = 5          # total 15
        self.grupo.save()
        self.outro.points = 12                # total 12
        self.outro.save()
        Group.objects.create(name="Fantasma", points=999, is_active=False)
        resp = anon_client().get("/api/leaderboard/")
        self.assertEqual(
            [(e["name"], e["total_points"]) for e in resp.data],
            [("Alfa", 15), ("Beta", 12)],
        )

    def test_desativar_grupo_via_patch(self):
        resp = staff_client().patch(
            f"/api/groups/{self.grupo.id}/", {"is_active": False}, format="json"
        )
        self.assertFalse(resp.data["is_active"])
        self.assertEqual(len(anon_client().get("/api/groups/?active=true").data), 1)
