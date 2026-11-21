from django.core.management import call_command
from django.test import TestCase

from apps.test_helpers import anon_client, staff_client, user_client

from .models import Group, GroupAbility, TeamAbilityTemplate


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
        self.ana = Student.objects.create(name="Ana", group=self.grupo, matricula="900001")
        self.bia = Student.objects.create(name="Bia", group=self.grupo, matricula="900002")
        self.caio = Student.objects.create(name="Caio", group=self.outro, matricula="900003")
        self.davi = Student.objects.create(name="Davi", matricula="900004")

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


def _templates():
    """8 modelos (2 temas x 3 básicas + 1 ultimate)."""
    from .models import TeamAbilityTemplate

    specs = []
    for theme in ("Floresta", "Vulcão"):
        for i in range(3):
            specs.append((theme, f"Basica {i}", "BASIC"))
        specs.append((theme, "Ultimate", "ULTIMATE"))
    return {
        (t.theme, t.name): t
        for t in (
            TeamAbilityTemplate.objects.create(
                theme=theme, name=name, kind=kind, effect="STRIKE",
                value=100 if kind == "BASIC" else 500,
            )
            for theme, name, kind in specs
        )
    }


class TeamAbilityAssignmentTests(TestCase):
    """Professor escolhe 3+1 habilidades na criação da equipe (ADR-021)."""

    def setUp(self):
        self.client = staff_client()
        self.tpl = _templates()
        self.basic = [
            self.tpl[("Floresta", f"Basica {i}")].id for i in range(3)
        ]
        self.ultimate = self.tpl[("Floresta", "Ultimate")].id

    def _create(self, abilities):
        return self.client.post(
            "/api/groups/",
            {"name": "Equipe Habilidades", "abilities": abilities},
            format="json",
        )

    def test_criacao_com_3_basicas_e_1_ultimate(self):
        resp = self._create(self.basic + [self.ultimate])
        self.assertEqual(resp.status_code, 201)
        group = Group.objects.get(name="Equipe Habilidades")
        self.assertEqual(group.abilities.count(), 4)
        kinds = sorted(
            group.abilities.values_list("template__kind", flat=True)
        )
        self.assertEqual(kinds, ["BASIC", "BASIC", "BASIC", "ULTIMATE"])

    def test_menos_de_quatro_erro(self):
        resp = self._create(self.basic[:2] + [self.ultimate])
        self.assertEqual(resp.status_code, 400)

    def test_duas_ultimates_erro(self):
        other_ult = self.tpl[("Vulcão", "Ultimate")].id
        resp = self._create(self.basic[:2] + [self.ultimate, other_ult])
        self.assertEqual(resp.status_code, 400)

    def test_template_inexistente_erro(self):
        resp = self._create(self.basic + [999999])
        self.assertEqual(resp.status_code, 400)

    def test_habilidade_repetida_erro(self):
        resp = self._create([self.basic[0], self.basic[0],
                             self.basic[1], self.ultimate])
        self.assertEqual(resp.status_code, 400)

    def test_patch_substitui_a_escolha_sem_duplicar(self):
        group = Group.objects.create(name="Troca")
        for tid in self.basic + [self.ultimate]:
            group.abilities.create(template_id=tid)
        novas = [
            self.tpl[("Vulcão", f"Basica {i}")].id for i in range(3)
        ] + [self.tpl[("Vulcão", "Ultimate")].id]
        resp = self.client.patch(
            f"/api/groups/{group.id}/", {"abilities": novas}, format="json"
        )
        self.assertEqual(resp.status_code, 200)
        group.refresh_from_db()
        self.assertEqual(group.abilities.count(), 4)
        themes = set(
            group.abilities.values_list("template__theme", flat=True)
        )
        self.assertEqual(themes, {"Vulcão"})

    def test_listagem_publica_com_filtro_de_tema(self):
        resp = anon_client().get("/api/team-abilities/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 8)
        resp = anon_client().get("/api/team-abilities/?theme=Vulcão")
        self.assertEqual(len(resp.data), 4)
        self.assertTrue(all(
            item["theme"] == "Vulcão" for item in resp.data
        ))

    def test_atribuicao_nasce_com_cargas_base(self):
        resp = self._create(self.basic + [self.ultimate])
        self.assertEqual(resp.status_code, 201)
        group = Group.objects.get(name="Equipe Habilidades")
        for ability in group.abilities.all():
            self.assertEqual(ability.charges_left, ability.template.max_charges)

    def test_troca_preserva_cargas_das_que_ficam(self):
        extra = TeamAbilityTemplate.objects.create(
            theme="Floresta", name="Basica Extra", kind="BASIC",
            effect="STRIKE", value=90, max_charges=3,
        )
        group = Group.objects.create(name="Cargas")
        for tid in self.basic + [self.ultimate]:
            group.abilities.create(template_id=tid, charges_left=1)
        novas = [extra.id, self.basic[1], self.basic[2], self.ultimate]
        resp = self.client.patch(
            f"/api/groups/{group.id}/", {"abilities": novas}, format="json"
        )
        self.assertEqual(resp.status_code, 200)
        group.refresh_from_db()
        self.assertEqual(group.abilities.count(), 4)
        # A que ficou mantém a carga gast; a nova nasce com a base.
        self.assertEqual(
            group.abilities.get(template_id=self.basic[1]).charges_left, 1
        )
        nova = group.abilities.get(template_id=extra.id)
        self.assertEqual(nova.charges_left, nova.template.max_charges)
        self.assertFalse(
            group.abilities.filter(template_id=self.basic[0]).exists()
        )

    def test_tema_misturado_rejeitado(self):
        mista = [
            self.basic[0], self.basic[1],
            self.tpl[("Vulcão", "Basica 2")].id, self.ultimate,
        ]
        resp = self.client.post(
            "/api/groups/", {"name": "Misto", "abilities": mista}, format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Group.objects.filter(name="Misto").count(), 0)


class SeedHabilidadesEquipeTests(TestCase):
    """seed_habilidades_equipe: catálogo por tema + atribuição 3+1 (ADR-021)."""

    def test_atribui_3plus1_escalado_e_pula_inativas(self):
        Group.objects.create(name="Alfa")
        Group.objects.create(name="Beta")
        Group.objects.create(name="Gamma", is_active=False)
        call_command("seed_habilidades_equipe")
        self.assertEqual(TeamAbilityTemplate.objects.count(), 8)
        for name in ("Alfa", "Beta"):
            group = Group.objects.get(name=name)
            self.assertEqual(group.abilities.count(), 4)
            kinds = sorted(
                group.abilities.values_list("template__kind", flat=True)
            )
            self.assertEqual(kinds, ["BASIC", "BASIC", "BASIC", "ULTIMATE"])
            # escala do bando pela referência padrão (4): ref=4, n=2 ativas
            basic = set(
                group.abilities.filter(
                    template__kind="BASIC"
                ).values_list("charges_left", flat=True)
            )
            ultimate = set(
                group.abilities.filter(
                    template__kind="ULTIMATE"
                ).values_list("charges_left", flat=True)
            )
            self.assertEqual(basic, {4})
            self.assertEqual(ultimate, {2})
        self.assertEqual(
            Group.objects.get(name="Gamma").abilities.count(), 0
        )

    def test_repetir_nao_duplica_e_respeita_escolha_do_professor(self):
        Group.objects.create(name="Alfa")
        call_command("seed_habilidades_equipe")
        self.assertEqual(GroupAbility.objects.count(), 4)
        # escolha do professor: troca para Vulcão antes de rodar de novo
        alfa = Group.objects.get(name="Alfa")
        vulcao = list(
            TeamAbilityTemplate.objects.filter(theme="Vulcão")
            .order_by("kind", "name")
        )
        alfa.abilities.all().delete()
        for template in vulcao:
            alfa.abilities.create(template=template)
        call_command("seed_habilidades_equipe")
        self.assertEqual(GroupAbility.objects.count(), 4)
        self.assertEqual(
            set(alfa.abilities.values_list("template__theme", flat=True)),
            {"Vulcão"},
        )

    def test_flag_no_assign_so_cria_templates(self):
        Group.objects.create(name="Alfa")
        call_command("seed_habilidades_equipe", "--no-assign")
        self.assertEqual(TeamAbilityTemplate.objects.count(), 8)
        self.assertEqual(GroupAbility.objects.count(), 0)
