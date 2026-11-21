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

    def test_listagem_do_professor_e_filtro_por_grupo(self):
        Student.objects.create(name="Ana", group=self.alfa, matricula="900011")
        Student.objects.create(name="Bia", group=self.beta, matricula="900012")

        resp = staff_client().get("/api/students/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

        filtrado = staff_client().get(f"/api/students/?group={self.alfa.id}")
        self.assertEqual(filtrado.status_code, 200)
        self.assertEqual(len(filtrado.data), 1)
        self.assertEqual(filtrado.data[0]["group_name"], "Alfa")

    def test_visitante_nao_le_nem_escreve(self):
        self.assertEqual(anon_client().get("/api/students/").status_code, 401)
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
            {"name": "Ana", "matricula": "900041", "group": self.alfa.id, "user": login.id},
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
            "/api/students/",
            {"name": "Sem Vínculo", "matricula": "900042"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIsNone(resp.data["group_name"])
        self.assertIsNone(resp.data["username"])

    def test_criacao_exige_matricula_de_exatamente_6_digitos(self):
        client = staff_client()

        # Obrigatória: sem o campo, 400.
        sem_matricula = client.post("/api/students/", {"name": "Zé"}, format="json")
        self.assertEqual(sem_matricula.status_code, 400)
        self.assertIn("matricula", sem_matricula.data)

        # Formato: nem mais, nem menos que 6 dígitos.
        for invalida in ("12345", "1234567", "abcdef", "12456", "12345a", "12 456"):
            resp = client.post(
                "/api/students/", {"name": "Zé", "matricula": invalida}, format="json"
            )
            self.assertEqual(resp.status_code, 400, f"deveria rejeitar {invalida!r}")

        # Vazia também é rejeitada.
        vazia = client.post(
            "/api/students/", {"name": "Zé", "matricula": ""}, format="json"
        )
        self.assertEqual(vazia.status_code, 400)

        # 6 dígitos passam — inclusive com zero à esquerda (guardado como texto).
        ok = client.post(
            "/api/students/", {"name": "Zé", "matricula": "012345"}, format="json"
        )
        self.assertEqual(ok.status_code, 201, ok.data)
        self.assertEqual(ok.data["matricula"], "012345")

    def test_matricula_e_unica_entre_alunos(self):
        client = staff_client()
        primeiro = client.post(
            "/api/students/", {"name": "Ana", "matricula": "777001"}, format="json"
        )
        self.assertEqual(primeiro.status_code, 201)

        duplicada = client.post(
            "/api/students/", {"name": "Outra Ana", "matricula": "777001"},
            format="json",
        )
        self.assertEqual(duplicada.status_code, 400)

        # PATCH com matrícula inválida também é rejeitado.
        url = f"/api/students/{primeiro.data['id']}/"
        self.assertEqual(
            client.patch(url, {"matricula": "99"}, format="json").status_code, 400
        )
        # PATCH trocando por uma válida de outro aluno segue a unicidade.
        client.post(
            "/api/students/", {"name": "Bia", "matricula": "777002"}, format="json"
        )
        self.assertEqual(
            client.patch(url, {"matricula": "777002"}, format="json").status_code, 400
        )

    def test_listagem_inclui_matricula(self):
        Student.objects.create(name="Ana", matricula="900013")
        resp = staff_client().get("/api/students/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data[0]["matricula"], "900013")
