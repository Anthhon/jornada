from django.test import SimpleTestCase, TestCase

from apps.bosses.engine import Ability
from apps.bosses.models import Boss, BossAbility
from apps.groups.models import Group
from apps.test_helpers import anon_client, staff_client, user_client

from . import engine
from .models import ArenaRound


class ArenaEngineTests(SimpleTestCase):
    """Motor PURO — sem banco (fronteira de camadas, PLANO.md §4.7)."""

    def _raid(self, hp=10000, groups=(1, 2)):
        return engine.new_raid(hp, group_ids=groups)

    def test_novo_raid_comeca_config(self):
        state = self._raid()
        self.assertEqual(state.status, engine.STATUS_CONFIG)
        self.assertEqual(state.hp, 10000)
        self.assertEqual(set(state.teams), {1, 2})

    def test_start_passa_para_running(self):
        state = self._raid()
        engine.start(state)
        self.assertEqual(state.status, engine.STATUS_RUNNING)

    def test_start_duas_vezes_erro(self):
        state = self._raid()
        engine.start(state)
        with self.assertRaises(engine.ArenaError):
            engine.start(state)

    def test_ciclo_pause_resume_end(self):
        state = self._raid()
        engine.start(state)
        engine.pause(state)
        self.assertEqual(state.status, engine.STATUS_PAUSED)
        engine.resume(state)
        self.assertEqual(state.status, engine.STATUS_RUNNING)
        engine.end(state)
        self.assertEqual(state.status, engine.STATUS_ENDED)

    def test_pause_fora_de_running_erro(self):
        state = self._raid()
        with self.assertRaises(engine.ArenaError):
            engine.pause(state)

    def test_apply_performance_dano_base(self):
        state = self._raid()
        engine.start(state)
        engine.apply_performance(state, 1, 800)  # 800 * 1.5 = 1200
        self.assertEqual(state.teams[1].base_damage, 1200)
        self.assertEqual(state.hp, 8800)

    def test_attack_acerto_causa_dano_e_retalia(self):
        state = self._raid()
        engine.start(state)
        events = engine.attack(state, 1, correct=True, points=100)
        self.assertEqual(state.teams[1].battle_damage, 100)
        self.assertEqual(state.hp, 9900)
        # retaliação = 100 * 0.25 = 25
        self.assertEqual(state.teams[1].retaliation_loss, 25)
        kinds = [e.kind for e in events]
        self.assertIn(engine.KIND_DAMAGE, kinds)
        self.assertIn(engine.KIND_RETALIATION, kinds)

    def test_attack_erro_nao_causa_dano(self):
        state = self._raid()
        engine.start(state)
        engine.attack(state, 1, correct=False, points=100)
        self.assertEqual(state.teams[1].battle_damage, 0)
        self.assertEqual(state.hp, 10000)
        self.assertEqual(state.teams[1].retaliation_loss, 0)

    def test_add_damage_manual_sem_retaliacao(self):
        state = self._raid()
        engine.start(state)
        engine.add_damage(state, 1, 500)
        self.assertEqual(state.teams[1].battle_damage, 500)
        self.assertEqual(state.teams[1].retaliation_loss, 0)

    def test_compute_rewards_proporcional(self):
        state = self._raid(hp=100000)
        engine.start(state)
        engine.apply_performance(state, 1, 800)                 # 1200 base
        engine.attack(state, 1, correct=True, points=100)       # +100 batalha, -25 retaliação
        engine.apply_performance(state, 2, 400)                 # 600 base
        rewards = engine.compute_rewards(state)
        self.assertEqual(rewards[1], 1300 - 25)  # 1275
        self.assertEqual(rewards[2], 600)

    def test_vitoria_quando_hp_zera(self):
        state = self._raid(hp=100)
        engine.start(state)
        engine.add_damage(state, 1, 150)
        self.assertTrue(state.is_over)
        self.assertEqual(state.status, engine.STATUS_ENDED)
        self.assertEqual(state.log[-1].kind, engine.KIND_END)

    def test_ataque_fora_de_running_erro(self):
        state = self._raid()
        with self.assertRaises(engine.ArenaError):
            engine.attack(state, 1, correct=True, points=10)

    def test_ataque_equipe_nao_registrada_erro(self):
        state = self._raid(groups=(1,))
        engine.start(state)
        with self.assertRaises(engine.ArenaError):
            engine.attack(state, 99, correct=True, points=10)

    def test_adjust_points(self):
        state = self._raid(hp=100000)
        engine.start(state)
        engine.adjust_points(state, 1, 50)
        self.assertEqual(state.teams[1].manual_adjustment, 50)


class ArenaApiTests(TestCase):
    """API da Arena: CRUD + ciclo de vida + estado público."""

    def setUp(self):
        self.boss = Boss.objects.create(name="Vigia", max_hp=15000)
        self.group = Group.objects.create(name="Equipe Alfa")

    def _create_round(self, client=None):
        client = client or staff_client()
        return client.post(
            "/api/arena/rounds/",
            {"name": "Rodada 1", "boss": self.boss.id, "max_hp": 15000},
            format="json",
        )

    def test_professor_cria_rodada(self):
        resp = self._create_round()
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["status"], "CONFIG")

    def test_criacao_ajusta_hp_ao_max(self):
        """M-41: a rodada nova nasce com PV igual ao PV máximo informado."""
        resp = staff_client().post(
            "/api/arena/rounds/",
            {"name": "Rodada 2", "boss": self.boss.id, "max_hp": 22000},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["max_hp"], 22000)
        self.assertEqual(resp.data["hp"], 22000)

    def test_anon_nao_cria_rodada(self):
        resp = anon_client().post(
            "/api/arena/rounds/", {"name": "X", "boss": self.boss.id}, format="json"
        )
        self.assertIn(resp.status_code, (401, 403))

    def test_aluno_nao_cria_rodada(self):
        resp = user_client().post(
            "/api/arena/rounds/", {"name": "X", "boss": self.boss.id}, format="json"
        )
        self.assertEqual(resp.status_code, 403)

    def test_ciclo_completo_start_attack_end(self):
        client = staff_client()
        created = self._create_round(client)
        rid = created.data["id"]

        resp = client.post(f"/api/arena/rounds/{rid}/start/", {}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "RUNNING")

        resp = client.post(
            f"/api/arena/rounds/{rid}/attack/",
            {"group_id": self.group.id, "correct": True, "points": 100},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

        state = anon_client().get(f"/api/arena/rounds/{rid}/state/")
        self.assertEqual(state.status_code, 200)
        self.assertEqual(state.data["hp"], 15000 - 100)
        team = state.data["teams"][0]
        self.assertEqual(team["group_id"], self.group.id)
        self.assertEqual(team["battle_damage"], 100)
        self.assertEqual(team["retaliation_loss"], 25)  # 100 * 0.25

        before = Group.objects.get(id=self.group.id).points
        resp = client.post(f"/api/arena/rounds/{rid}/end/", {}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "ENDED")
        after = Group.objects.get(id=self.group.id).points
        self.assertEqual(after, before + 75)  # (100 * 1.0) - 25

    def test_state_e_publico(self):
        created = self._create_round()
        rid = created.data["id"]
        resp = anon_client().get(f"/api/arena/rounds/{rid}/state/")
        self.assertEqual(resp.status_code, 200)

    def test_ataque_antes_de_iniciar_erro(self):
        client = staff_client()
        created = self._create_round(client)
        rid = created.data["id"]
        resp = client.post(
            f"/api/arena/rounds/{rid}/attack/",
            {"group_id": self.group.id, "correct": True, "points": 10},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_nao_duplica_recompensa(self):
        client = staff_client()
        created = self._create_round(client)
        rid = created.data["id"]
        client.post(f"/api/arena/rounds/{rid}/start/", {}, format="json")
        client.post(
            f"/api/arena/rounds/{rid}/attack/",
            {"group_id": self.group.id, "correct": True, "points": 100},
            format="json",
        )
        client.post(f"/api/arena/rounds/{rid}/end/", {}, format="json")
        first = Group.objects.get(id=self.group.id).points
        resp = client.post(f"/api/arena/rounds/{rid}/end/", {}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Group.objects.get(id=self.group.id).points, first)


def _ability(**kwargs):
    base = {"name": "Habilidade", "trigger": "TEMPO", "effect": "PENALTY", "value": 10}
    base.update(kwargs)
    return Ability(**base)


class ArenaAbilityEngineTests(SimpleTestCase):
    """Habilidades do chefe executando na raid — motor PURO (ADR-017)."""

    def _raid(self, abilities, hp=10000, groups=(1, 2)):
        state = engine.new_raid(hp, group_ids=groups, abilities=abilities)
        engine.start(state)
        return state

    def test_penalidade_reduz_dano_base_sem_tocar_no_hp(self):
        state = self._raid([_ability()])
        events = engine.apply_performance(state, 1, 800, criteria={"tempo": 1})
        # 800 * 1.5 = 1200 de dano; a habilidade tira 10 do Dano Base da equipe
        self.assertEqual(state.teams[1].base_damage, 1200 - 10)
        self.assertEqual(state.hp, 10000 - 1200)
        self.assertIn(engine.KIND_ABILITY, [e.kind for e in events])

    def test_sem_notas_não_dispara_habilidade(self):
        state = self._raid([_ability()])
        events = engine.apply_performance(state, 1, 800)
        self.assertNotIn(engine.KIND_ABILITY, [e.kind for e in events])
        self.assertEqual(state.teams[1].base_damage, 1200)

    def test_notas_boas_não_disparam(self):
        state = self._raid([_ability()])
        good = dict.fromkeys(("tempo", "historico", "paradigma", "caracteristicas",
                              "usos", "codigo", "criatividade"), 3)
        events = engine.apply_performance(state, 1, 800, criteria=good)
        self.assertNotIn(engine.KIND_ABILITY, [e.kind for e in events])
        self.assertEqual(state.teams[1].base_damage, 1200)

    def test_registro_duplo_com_notas_erro(self):
        state = self._raid([_ability()])
        engine.apply_performance(state, 1, 800, criteria={"tempo": 1})
        with self.assertRaises(engine.ArenaError):
            engine.apply_performance(state, 1, 800, criteria={"tempo": 3})

    def test_cura_do_chefe_com_nota_ruim(self):
        state = self._raid([_ability(effect="HEAL", value=5)])
        engine.apply_performance(state, 1, 800, criteria={"tempo": 1})
        self.assertEqual(state.hp, 10000 - 1200 + 5)

    def test_drenagem_reduz_dano_e_recupera_pv(self):
        state = self._raid([_ability(effect="DRAIN", value=50)])
        engine.apply_performance(state, 1, 800, criteria={"tempo": 1})
        self.assertEqual(state.teams[1].base_damage, 1200 - 50)
        self.assertEqual(state.hp, 10000 - 1200 + 50)

    def test_corte_reduz_o_dano_do_ataque_seguinte(self):
        state = self._raid([_ability(effect="CUT", value=50)])
        engine.apply_performance(state, 1, 800, criteria={"tempo": 1})
        self.assertEqual(state.teams[1].damage_factor, 0.5)
        engine.attack(state, 1, correct=True, points=10)
        self.assertEqual(state.teams[1].battle_damage, 5)  # 10 * 0.5
        self.assertEqual(state.teams[1].retaliation_loss, 1)  # round(5 * 0.25)

    def test_corte_só_afeta_a_equipe_cortada(self):
        state = self._raid([_ability(effect="CUT", value=50)])
        engine.apply_performance(state, 1, 800, criteria={"tempo": 1})
        engine.apply_performance(state, 2, 800, criteria={"tempo": 3})
        engine.attack(state, 2, correct=True, points=10)
        self.assertEqual(state.teams[2].battle_damage, 10)  # sem corte

    def test_erro_dispara_habilidade_a_cada_dois(self):
        state = self._raid([_ability(trigger="PERGUNTAS", value=10, every=2)])
        engine.apply_performance(state, 1, 800)
        engine.attack(state, 1, correct=False, points=0)
        self.assertEqual(state.teams[1].base_damage, 1200)  # 1º erro: nada
        engine.attack(state, 1, correct=False, points=0)
        self.assertEqual(state.teams[1].base_damage, 1200 - 10)  # 2º erro: caiu
        self.assertEqual(state.teams[1].wrong_answers, 2)

    def test_alianca_espera_a_segunda_equipe_afetada(self):
        state = self._raid([_ability(scope="ALLIANCE", min_count=2)])
        engine.apply_performance(state, 1, 800, criteria={"tempo": 1})
        self.assertEqual(state.teams[1].base_damage, 1200)  # só 1 afetada
        engine.apply_performance(state, 2, 800, criteria={"tempo": 1})
        self.assertEqual(state.teams[2].base_damage, 1200 - 10)  # 2ª dispara
        self.assertEqual(state.teams[1].base_damage, 1200)  # sem retroativo

    def test_ataque_com_pontos_zero_e_erro_não_explode(self):
        state = self._raid([_ability(effect="CUT", value=150)])
        engine.apply_performance(state, 1, 800, criteria={"tempo": 1})
        self.assertEqual(state.teams[1].damage_factor, 0.0)  # corte limita a 0
        engine.attack(state, 1, correct=True, points=10)
        self.assertEqual(state.teams[1].battle_damage, 0)


class ArenaAbilityApiTests(TestCase):
    """Notas por critério + habilidades na API da raid (ADR-017)."""

    def setUp(self):
        self.boss = Boss.objects.create(name="Vigia", max_hp=15000)
        BossAbility.objects.create(
            boss=self.boss, name="Olhar", trigger="TEMPO", effect="PENALTY", value=10
        )
        BossAbility.objects.create(
            boss=self.boss, name="Enxame", trigger="PERGUNTAS",
            effect="PENALTY", value=10, every=2,
        )
        self.group = Group.objects.create(name="Equipe Alfa")
        self.client = staff_client()
        created = self.client.post(
            "/api/arena/rounds/",
            {"name": "Rodada 1", "boss": self.boss.id, "max_hp": 15000},
            format="json",
        )
        self.rid = created.data["id"]
        self.client.post(f"/api/arena/rounds/{self.rid}/start/", {}, format="json")

    def _criteria(self, tempo=3):
        return {
            "tempo": tempo, "historico": 3, "paradigma": 3,
            "caracteristicas": 3, "usos": 3, "codigo": 3, "criatividade": 3,
        }

    def _apply(self, payload):
        return self.client.post(
            f"/api/arena/rounds/{self.rid}/apply-performance/",
            payload, format="json",
        )

    def test_notas_disparam_habilidade_e_chegam_no_estado(self):
        resp = self._apply({"group_id": self.group.id, "criteria": self._criteria(1)})
        self.assertEqual(resp.status_code, 200)
        state = anon_client().get(f"/api/arena/rounds/{self.rid}/state/")
        team = state.data["teams"][0]
        self.assertEqual(team["criteria"]["tempo"], 1)
        # desempenho derivado: (6*3)*10/18 = 10 -> 1000 * 1.5 = 1500; -10 da penalidade
        self.assertEqual(team["base_damage"], 1500 - 10)
        self.assertTrue(any(e["kind"] == "ABILITY" for e in state.data["events"]))
        # habilidades do chefe expostas no estado (para o card exibir)
        self.assertEqual(
            [a["name"] for a in state.data["boss"]["abilities"]],
            ["Olhar", "Enxame"],
        )

    def test_desempenho_explícito_sobrescreve_o_derivado(self):
        resp = self._apply({
            "group_id": self.group.id, "criteria": self._criteria(1),
            "performance": 500,
        })
        self.assertEqual(resp.status_code, 200)
        state = anon_client().get(f"/api/arena/rounds/{self.rid}/state/")
        self.assertEqual(state.data["teams"][0]["base_damage"], 750 - 10)

    def test_notas_ruins_com_dano_zero_ainda_disparam(self):
        all_absent = dict.fromkeys(
            ("tempo", "historico", "paradigma", "caracteristicas",
             "usos", "codigo", "criatividade"), -1,
        )
        resp = self._apply({"group_id": self.group.id, "criteria": all_absent})
        self.assertEqual(resp.status_code, 200)
        state = anon_client().get(f"/api/arena/rounds/{self.rid}/state/")
        team = state.data["teams"][0]
        self.assertEqual(team["base_damage"], 0)  # dano derivado = 0
        self.assertTrue(any(e["kind"] == "ABILITY" for e in state.data["events"]))

    def test_notas_incompletas_erro(self):
        resp = self._apply({"group_id": self.group.id, "criteria": {"tempo": 1}})
        self.assertEqual(resp.status_code, 400)

    def test_nota_fora_da_escala_erro(self):
        crit = self._criteria()
        crit["tempo"] = 2
        resp = self._apply({"group_id": self.group.id, "criteria": crit})
        self.assertEqual(resp.status_code, 400)

    def test_notas_sem_group_id_erro(self):
        resp = self._apply({"criteria": self._criteria()})
        self.assertEqual(resp.status_code, 400)

    def test_registro_duplo_erro(self):
        self._apply({"group_id": self.group.id, "criteria": self._criteria()})
        resp = self._apply({"group_id": self.group.id, "criteria": self._criteria()})
        self.assertEqual(resp.status_code, 400)

    def test_erro_de_pergunta_dispara_a_cada_dois(self):
        self._apply({"group_id": self.group.id, "criteria": self._criteria()})
        client = self.client
        client.post(
            f"/api/arena/rounds/{self.rid}/attack/",
            {"group_id": self.group.id, "correct": False, "points": 0},
            format="json",
        )
        state = anon_client().get(f"/api/arena/rounds/{self.rid}/state/")
        self.assertEqual(state.data["teams"][0]["base_damage"], 1500)
        self.assertEqual(
            sum(1 for e in state.data["events"] if e["kind"] == "ABILITY"), 0
        )

        client.post(
            f"/api/arena/rounds/{self.rid}/attack/",
            {"group_id": self.group.id, "correct": False, "points": 0},
            format="json",
        )
        state = anon_client().get(f"/api/arena/rounds/{self.rid}/state/")
        team = state.data["teams"][0]
        self.assertEqual(team["base_damage"], 1500 - 10)
        self.assertEqual(team["wrong_answers"], 2)
        self.assertEqual(
            sum(1 for e in state.data["events"] if e["kind"] == "ABILITY"), 1
        )

    def test_acerto_com_corte_espelha_no_estado(self):
        # Corta o ataque via habilidade de CONCEITO com nota ruim
        BossAbility.objects.create(
            boss=self.boss, name="Asas", trigger="CONCEITO", effect="CUT", value=50
        )
        crit = self._criteria()
        crit["paradigma"] = 1
        self._apply({"group_id": self.group.id, "criteria": crit})
        self.client.post(
            f"/api/arena/rounds/{self.rid}/attack/",
            {"group_id": self.group.id, "correct": True, "points": 10},
            format="json",
        )
        state = anon_client().get(f"/api/arena/rounds/{self.rid}/state/")
        team = state.data["teams"][0]
        self.assertEqual(team["damage_factor"], 0.5)
        self.assertEqual(team["battle_damage"], 5)
