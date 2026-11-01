from django.contrib.auth.models import User
from django.test import TestCase

from apps.groups.models import Group
from apps.test_helpers import anon_client, staff_client, user_client

from .models import Profile, Student


class ProfileModelTests(TestCase):
    def test_profile_criado_para_usuario_novo(self):
        user = User.objects.create_user(username="joao")
        Profile.objects.create(user=user)
        self.assertEqual(user.profile.user, user)


class StudentApiTests(TestCase):
    """CRUD de alunos: vínculo com User e com equipe, filtro por grupo."""

    def setUp(self):
        self.alfa = Group.objects.create(name="Alfa")
        self.beta = Group.objects.create(name="Beta")

    def test_listagem_publica_e_filtro_por_grupo(self):
        Student.objects.create(name="Ana", group=self.alfa)
        Student.objects.create(name="Bia", group=self.beta)

        resp = anon_client().get("/api/students/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

        filtrado = anon_client().get(f"/api/students/?group={self.alfa.id}")
        self.assertEqual(filtrado.status_code, 200)
        self.assertEqual(len(filtrado.data), 1)
        self.assertEqual(filtrado.data[0]["group_name"], "Alfa")

    def test_visitante_nao_escreve(self):
        resp = anon_client().post("/api/students/", {"name": "X"}, format="json")
        self.assertIn(resp.status_code, (401, 403))

    def test_aluno_logado_nao_escreve(self):
        resp = user_client().post("/api/students/", {"name": "X"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_ciclo_do_professor_com_vinculos(self):
        login = User.objects.create_user(username="ana.login")
        client = staff_client()

        criado = client.post(
            "/api/students/",
            {"name": "Ana", "group": self.alfa.id, "user": login.id},
            format="json",
        )
        self.assertEqual(criado.status_code, 201)
        self.assertEqual(criado.data["group_name"], "Alfa")
        self.assertEqual(criado.data["username"], "ana.login")

        url = f"/api/students/{criado.data['id']}/"
        movido = client.patch(url, {"group": self.beta.id}, format="json")
        self.assertEqual(movido.status_code, 200)
        self.assertEqual(movido.data["group_name"], "Beta")

        self.assertEqual(client.delete(url).status_code, 204)
        self.assertFalse(Student.objects.filter(name="Ana").exists())

    def test_aluno_sem_grupo_e_sem_login_e_permitido(self):
        resp = staff_client().post(
            "/api/students/", {"name": "Sem Vínculo"}, format="json"
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIsNone(resp.data["group_name"])
        self.assertIsNone(resp.data["username"])
