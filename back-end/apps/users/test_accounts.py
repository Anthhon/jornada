"""Contas: criação de alunos em lote, perfil próprio, papéis e usuários."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from apps.groups.models import Group
from apps.test_helpers import anon_client, staff_client, user_client

from .models import Student


class BulkStudentTests(TestCase):
    def test_cria_varios_alunos_com_login_e_senha_gerados(self):
        grupo = Group.objects.create(name="Alfa")
        resp = staff_client().post(
            "/api/students/bulk/",
            {"names": ["João da Silva", "  Maria  ", "Ana Souza"], "group": grupo.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(
            [r["name"] for r in resp.data], ["João da Silva", "Maria", "Ana Souza"]
        )
        # resposta traz só o necessário para o professor repassar
        self.assertEqual(set(resp.data[0]), {"id", "name", "username", "password"})
        self.assertEqual(resp.data[0]["username"], "joao.da.silva")
        self.assertEqual(Student.objects.filter(group=grupo).count(), 3)

        # a senha devolvida realmente loga
        login = APIClient().post(
            "/api/token/",
            {"username": resp.data[0]["username"], "password": resp.data[0]["password"]},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertIn("access", login.data)

    def test_usernames_repetidos_ganham_sufixo(self):
        resp = staff_client().post(
            "/api/students/bulk/", {"names": ["Ana Lima", "Ana Lima"]}, format="json"
        )
        self.assertEqual(
            [r["username"] for r in resp.data], ["ana.lima", "ana.lima2"]
        )

    def test_senhas_diferentes_e_aluno_nao_e_professor(self):
        resp = staff_client().post(
            "/api/students/bulk/", {"names": ["A", "B", "C"]}, format="json"
        )
        self.assertEqual(len({r["password"] for r in resp.data}), 3)
        self.assertFalse(User.objects.get(username="a").is_staff)

    def test_so_professor_cria_em_lote(self):
        self.assertEqual(
            anon_client().post("/api/students/bulk/", {"names": ["X"]}, format="json").status_code,
            401,
        )
        self.assertEqual(
            user_client().post("/api/students/bulk/", {"names": ["X"]}, format="json").status_code,
            403,
        )

    def test_lista_vazia_ou_grupo_invalido_rejeitado(self):
        client = staff_client()
        self.assertEqual(client.post("/api/students/bulk/", {"names": []}, format="json").status_code, 400)
        self.assertEqual(client.post("/api/students/bulk/", {"names": ["  "]}, format="json").status_code, 400)
        self.assertEqual(
            client.post("/api/students/bulk/", {"names": ["X"], "group": 999}, format="json").status_code, 400
        )
        self.assertFalse(Student.objects.exists())


class StudentOwnProfileTests(TestCase):
    def setUp(self):
        self.ana = user_client("ana")
        self.bia = user_client("bia")

    def test_aluno_so_enxerga_o_proprio_perfil(self):
        resp = self.ana.get("/api/students/")
        self.assertEqual([s["name"] for s in resp.data], ["ana"])

    def test_aluno_nao_abre_perfil_de_outro(self):
        outro = Student.objects.get(name="bia")
        self.assertEqual(self.ana.get(f"/api/students/{outro.id}/").status_code, 404)

    def test_aluno_nao_edita_nem_a_si_mesmo(self):
        proprio = Student.objects.get(name="ana")
        resp = self.ana.patch(f"/api/students/{proprio.id}/", {"grade": "10"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_visitante_recebe_401(self):
        self.assertEqual(anon_client().get("/api/students/").status_code, 401)


class StudentGradeAndDeactivateTests(TestCase):
    def test_professor_lanca_nota_individual(self):
        aluno = Student.objects.create(name="Ana")
        client = staff_client()
        resp = client.patch(f"/api/students/{aluno.id}/", {"grade": "8.50"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["grade"], "8.50")
        invalida = client.patch(f"/api/students/{aluno.id}/", {"grade": "11"}, format="json")
        self.assertEqual(invalida.status_code, 400)

    def test_desativar_aluno_bloqueia_o_login(self):
        resp = staff_client().post("/api/students/bulk/", {"names": ["Ana"]}, format="json")
        dados = resp.data[0]
        antes = APIClient().post(
            "/api/token/", {"username": dados["username"], "password": dados["password"]}, format="json"
        )
        self.assertEqual(antes.status_code, 200)

        off = staff_client().patch(
            f"/api/students/{dados['id']}/", {"is_active": False}, format="json"
        )
        self.assertEqual(off.status_code, 200)
        depois = APIClient().post(
            "/api/token/", {"username": dados["username"], "password": dados["password"]}, format="json"
        )
        self.assertEqual(depois.status_code, 401)

    def test_filtro_active(self):
        Student.objects.create(name="On")
        Student.objects.create(name="Off", is_active=False)
        resp = staff_client().get("/api/students/?active=false")
        self.assertEqual([s["name"] for s in resp.data], ["Off"])


class MeAndRolesTests(TestCase):
    def test_me_diz_o_papel(self):
        prof = staff_client().get("/api/me/")
        self.assertEqual(prof.data["role"], "teacher")
        self.assertIsNone(prof.data["student"])
        aluno = user_client("ana").get("/api/me/")
        self.assertEqual(aluno.data["role"], "student")
        self.assertEqual(aluno.data["student"]["name"], "ana")

    def test_usuario_sem_registro_de_aluno_e_professor(self):
        # regra do front-end.md: não-aluno é interpretado como professor/admin
        user = User.objects.create_user(username="coordenacao")
        client = APIClient()
        client.force_authenticate(user=user)
        self.assertEqual(client.get("/api/me/").data["role"], "teacher")
        self.assertEqual(
            client.post("/api/groups/", {"name": "Novo"}, format="json").status_code, 201
        )

    def test_me_exige_login(self):
        self.assertEqual(anon_client().get("/api/me/").status_code, 401)


class UserCrudTests(TestCase):
    def test_aluno_nao_lista_usuarios(self):
        self.assertEqual(user_client().get("/api/users/").status_code, 403)
        self.assertEqual(anon_client().get("/api/users/").status_code, 401)

    def test_ciclo_do_professor_senha_nunca_volta(self):
        client = staff_client()
        criado = client.post(
            "/api/users/",
            {"username": "nova.prof", "password": "senha-forte-1", "first_name": "Nova"},
            format="json",
        )
        self.assertEqual(criado.status_code, 201)
        self.assertNotIn("password", criado.data)
        self.assertTrue(User.objects.get(username="nova.prof").check_password("senha-forte-1"))

        url = f"/api/users/{criado.data['id']}/"
        trocou = client.patch(url, {"password": "outra-senha-2"}, format="json")
        self.assertEqual(trocou.status_code, 200)
        self.assertTrue(User.objects.get(username="nova.prof").check_password("outra-senha-2"))

    def test_delete_desativa_em_vez_de_apagar(self):
        alvo = User.objects.create_user(username="saindo")
        resp = staff_client().delete(f"/api/users/{alvo.id}/")
        self.assertEqual(resp.status_code, 204)
        alvo.refresh_from_db()
        self.assertFalse(alvo.is_active)

    def test_nao_desativa_a_si_mesmo(self):
        client = staff_client("chefe")
        eu = User.objects.get(username="chefe")
        self.assertEqual(client.delete(f"/api/users/{eu.id}/").status_code, 400)
