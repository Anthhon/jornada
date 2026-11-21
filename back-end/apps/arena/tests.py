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
            # escala do bando desligada (ADR-020) p/ valores exatos deste teste
            {"name": "Rodada 1", "boss": self.boss.id, "max_hp": 15000,
             "balance_ref_teams": 0},
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
            # escala do bando desligada (ADR-020) p/ valores exatos deste teste
            {"name": "Rodada 1", "boss": self.boss.id, "max_hp": 15000,
             "balance_ref_teams": 0},
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


class ArenaBalanceTests(SimpleTestCase):
    """Escala do bando — menos equipes = mais fortes (ADR-020)."""

    def _raid(self, groups=(1,), ref=4, hp=10000):
        config = engine.RaidConfig(balance_ref_teams=ref)
        return engine.new_raid(hp, config=config, group_ids=groups)

    def test_escala_desligada_por_padrao_no_motor(self):
        state = engine.new_raid(1000, group_ids=(1,))
        self.assertEqual(state.config.balance_ref_teams, 0)
        self.assertEqual(engine.balance_factor(state), 1.0)

    def test_uma_equipe_dobra_o_dano(self):
        state = self._raid(groups=(1,), ref=4)  # 4/1 = 2.0 (limite)
        engine.start(state)
        engine.apply_performance(state, 1, 800)
        self.assertEqual(state.teams[1].base_damage, 2400)  # 800*1.5*2

    def test_muitas_equipes_dividem_a_forca(self):
        state = self._raid(groups=tuple(range(1, 9)), ref=4)  # 8 equipes
        self.assertEqual(engine.balance_factor(state), 0.5)
        engine.start(state)
        engine.apply_performance(state, 1, 800)
        self.assertEqual(state.teams[1].base_damage, 600)  # 800*1.5*0.5

    def test_fator_limitado_a_meio_ate_duplo(self):
        self.assertEqual(engine.balance_factor_of(4, 1), 2.0)
        self.assertEqual(engine.balance_factor_of(4, 100), 0.5)
        self.assertAlmostEqual(engine.balance_factor_of(4, 3), 4 / 3)
        self.assertEqual(engine.balance_factor_of(0, 3), 1.0)

    def test_ataque_tambem_escala_e_retalia_proporcional(self):
        state = self._raid(groups=(1,), ref=4)
        engine.start(state)
        events = engine.attack(state, 1, correct=True, points=100)
        # dano 100*2 = 200; retaliação 200*0.25 = 50 (a retaliação segue o dano)
        self.assertEqual(state.teams[1].battle_damage, 200)
        self.assertEqual(state.teams[1].retaliation_loss, 50)
        self.assertEqual(state.hp, 9800)
        self.assertEqual(len(events), 2)

    def test_cargas_de_habilidade_escalam_com_o_bando(self):
        self.assertEqual(engine.scaled_charges(2, 4, 4), 2)
        self.assertEqual(engine.scaled_charges(2, 4, 2), 4)   # poucas equipes
        self.assertEqual(engine.scaled_charges(2, 4, 8), 1)   # muitas equipes
        self.assertEqual(engine.scaled_charges(2, 0, 8), 2)   # desligado
        self.assertEqual(engine.scaled_charges(1, 4, 10), 1)  # nunca zero


class ArenaOutcomeTreasureTests(SimpleTestCase):
    """Saque do Chefe: vitória rateia, fuga fica com o chefe (ADR-018)."""

    def _raid(self, hp=1000, groups=(1, 2), treasure=1000):
        config = engine.RaidConfig(treasure=treasure)
        state = engine.new_raid(hp, config=config, group_ids=groups)
        engine.start(state)
        return state

    def test_encerrar_com_pv_define_fuga(self):
        state = self._raid(hp=1000)
        engine.attack(state, 1, correct=True, points=100)
        events = engine.end(state)
        self.assertEqual(state.outcome, engine.OUTCOME_RETREAT)
        self.assertEqual(state.status, engine.STATUS_ENDED)
        self.assertIn("escapa ferido com o saque", events[0].message)

    def test_zerar_pv_define_vitoria(self):
        state = self._raid(hp=50)
        engine.attack(state, 1, correct=True, points=100)
        self.assertEqual(state.outcome, engine.OUTCOME_VICTORY)
        self.assertEqual(state.status, engine.STATUS_ENDED)

    def test_golpe_final_anota_a_equipe(self):
        state = self._raid(hp=50)
        engine.attack(state, 1, correct=True, points=30)  # não zera
        self.assertIsNone(state.killing_team)
        engine.attack(state, 2, correct=True, points=30)  # zera
        self.assertEqual(state.killing_team, 2)

    def test_saque_somente_na_vitoria(self):
        state = self._raid(hp=1000, treasure=1000)
        engine.attack(state, 1, correct=True, points=100)
        engine.end(state)  # fuga
        self.assertEqual(engine.compute_treasure(state), {})

    def test_rateio_do_saque_soma_sempre_o_tesouro(self):
        state = self._raid(hp=100, treasure=1000)
        engine.attack(state, 1, correct=True, points=60)   # dano 60
        engine.attack(state, 2, correct=True, points=50)   # dano 50, zera (golpe final)
        shares = engine.compute_treasure(state)
        self.assertEqual(sum(shares.values()), 1000)
        # golpe final: 10% (100) + sobra do rateio para quem derrubou
        self.assertGreater(shares[2], shares[1])
        self.assertGreaterEqual(shares[2], 100)

    def test_sem_dano_sem_saque(self):
        state = self._raid(hp=100, treasure=1000)
        state.hp = 0
        state.outcome = engine.OUTCOME_VICTORY
        self.assertEqual(engine.compute_treasure(state), {})

    def test_saque_zero_vazio(self):
        state = self._raid(hp=100, treasure=0)
        state.hp = 0
        state.outcome = engine.OUTCOME_VICTORY
        self.assertEqual(engine.compute_treasure(state), {})


def _team_ability(team_id, ability_id, name="Golpe", effect="STRIKE",
                  value=100, max_charges=2, charges=2, kind="BASIC"):
    return engine.TeamAbilityState(
        id=ability_id, template_id=ability_id, name=name, kind=kind,
        effect=effect, value=value, max_charges=max_charges,
        charges_left=charges,
    )


class ArenaTeamAbilityTests(SimpleTestCase):
    """Habilidades de equipe com d20 (ADR-019/021)."""

    def _raid(self, hp=10000, abilities=None, ref=0):
        config = engine.RaidConfig(balance_ref_teams=ref)
        state = engine.new_raid(hp, config=config, group_ids=(1,))
        state.teams[1].abilities = (
            abilities if abilities is not None else [
                _team_ability(1, 11, name="Golpe", effect="STRIKE", value=100),
                _team_ability(1, 12, name="Cura", effect="HEAL", value=40),
                _team_ability(1, 13, name="Escudo", effect="SHIELD", value=60),
                _team_ability(1, 14, name="Fúria", effect="BUFF", value=30,
                              max_charges=1, kind="ULTIMATE"),
            ]
        )
        engine.start(state)
        return state

    def test_d20_critico_dobra_e_falha_metade(self):
        self.assertEqual(engine.d20_multiplier(20), 2.0)
        self.assertEqual(engine.d20_multiplier(19), 2.0)
        self.assertEqual(engine.d20_multiplier(1), 0.5)
        self.assertEqual(engine.d20_multiplier(2), 0.5)
        self.assertEqual(engine.d20_multiplier(10), 1.0)

    def test_strike_causa_dano_e_gasta_carga(self):
        state = self._raid()
        events = engine.use_ability(state, 1, 11, roll=10)
        self.assertEqual(state.teams[1].battle_damage, 100)
        self.assertEqual(state.hp, 9900)
        self.assertEqual(state.teams[1].abilities[0].charges_left, 1)
        ev = events[0]
        self.assertEqual(ev.kind, engine.KIND_ABILITY)
        self.assertEqual(ev.actor, engine.ACTOR_TEAM)
        self.assertEqual(ev.roll, 10)
        self.assertEqual(ev.ability_id, 11)
        self.assertEqual(ev.ability_name, "Golpe")

    def test_strike_com_critico_e_falha(self):
        state = self._raid()
        engine.use_ability(state, 1, 11, roll=20)
        self.assertEqual(state.teams[1].battle_damage, 200)  # ×2
        engine.use_ability(state, 1, 11, roll=1)
        self.assertEqual(state.teams[1].battle_damage, 250)  # +50 (÷2)

    def test_sem_carga_erro(self):
        state = self._raid(
            abilities=[_team_ability(1, 11, charges=0, max_charges=0)]
        )
        with self.assertRaises(engine.ArenaError):
            engine.use_ability(state, 1, 11, roll=10)

    def test_habilidade_desconhecida_erro(self):
        state = self._raid()
        with self.assertRaises(engine.ArenaError):
            engine.use_ability(state, 1, 999, roll=10)

    def test_fora_de_running_erro(self):
        state = self._raid()
        engine.pause(state)
        with self.assertRaises(engine.ArenaError):
            engine.use_ability(state, 1, 11, roll=10)

    def test_roll_fora_do_d20_erro(self):
        state = self._raid()
        with self.assertRaises(engine.ArenaError):
            engine.use_ability(state, 1, 11, roll=21)

    def test_cura_recupera_pontos_de_retaliacao(self):
        state = self._raid()
        state.teams[1].retaliation_loss = 50
        engine.use_ability(state, 1, 12, roll=10)  # cura 40
        self.assertEqual(state.teams[1].retaliation_loss, 10)

    def test_cura_sem_perda_nao_inverte(self):
        state = self._raid()
        state.teams[1].retaliation_loss = 0
        engine.use_ability(state, 1, 12, roll=10)
        self.assertEqual(state.teams[1].retaliation_loss, 0)

    def test_escudo_absorve_retaliacao_do_ataque(self):
        state = self._raid()
        engine.use_ability(state, 1, 13, roll=10)  # escudo 60
        self.assertEqual(state.teams[1].shield, 60)
        engine.attack(state, 1, correct=True, points=100)  # retalia 25
        self.assertEqual(state.teams[1].shield, 35)
        self.assertEqual(state.teams[1].retaliation_loss, 0)

    def test_escudo_absorve_penalidade_do_chefe(self):
        from apps.bosses.engine import Ability

        state = self._raid()
        engine.use_ability(state, 1, 13, roll=10)  # escudo 60
        state.teams[1].base_damage = 500
        ability = Ability(name="Maldição", trigger="TEMPO", effect="PENALTY", value=100)
        events = []
        engine._apply_ability(state, ability, state.teams[1], events)
        # escudo cobre 60, a penalidade tira só 40 do dano base
        self.assertEqual(state.teams[1].base_damage, 460)
        self.assertEqual(state.teams[1].shield, 0)
        self.assertIn("Escudo absorveu 60", events[0].message)

    def test_buff_potencializa_o_proximo_ataque(self):
        state = self._raid()
        engine.use_ability(state, 1, 14, roll=10)  # +30%
        self.assertAlmostEqual(state.teams[1].damage_buff, 0.3)
        engine.attack(state, 1, correct=True, points=100)
        self.assertEqual(state.teams[1].battle_damage, 130)  # 100 * 1.3
        self.assertEqual(state.teams[1].damage_buff, 0.0)    # consumido
        engine.attack(state, 1, correct=True, points=100)
        self.assertEqual(state.teams[1].battle_damage, 230)  # volta ao normal

    def test_renovacao_repoi_as_cargas_escalonadas(self):
        state = self._raid(ref=4)  # 1 equipe -> cargas x4
        for ability in state.teams[1].abilities:
            ability.charges_left = 0
        engine.renew_abilities(state, 1)
        charges = [a.charges_left for a in state.teams[1].abilities]
        self.assertEqual(charges, [8, 8, 8, 4])  # básicas 2x4, ultimate 1x4

    def test_renovacao_sem_habilidades_erro(self):
        state = self._raid(abilities=[])
        with self.assertRaises(engine.ArenaError):
            engine.renew_abilities(state, 1)


class ArenaOutcomeApiTests(TestCase):
    """Desfecho, saque, escala e rematch via API (ADR-018/020)."""

    def setUp(self):
        self.boss = Boss.objects.create(name="Vigia", max_hp=100)
        self.g1 = Group.objects.create(name="Equipe Alfa")
        self.g2 = Group.objects.create(name="Equipe Beta")
        self.client = staff_client()

    def _create(self, **extra):
        payload = {"name": "Rodada", "boss": self.boss.id, "max_hp": 100}
        payload.update(extra)
        resp = self.client.post("/api/arena/rounds/", payload, format="json")
        return resp.data["id"]

    def _start(self, rid):
        self.client.post(f"/api/arena/rounds/{rid}/start/", {}, format="json")

    def test_estado_expoe_desfecho_saque_e_escala(self):
        rid = self._create(treasure=500, balance_ref_teams=4)
        self._start(rid)
        state = anon_client().get(f"/api/arena/rounds/{rid}/state/")
        self.assertEqual(state.status_code, 200)
        self.assertEqual(state.data["treasure"], 500)
        self.assertEqual(state.data["balance_ref_teams"], 4)
        self.assertEqual(state.data["outcome"], "")
        self.assertEqual(state.data["balance"], 2.0)  # ref 4 ÷ 2 equipes
        self.assertEqual(len(state.data["teams"]), 2)

    def test_vitoria_rateia_o_saque_no_placar(self):
        rid = self._create(treasure=500, balance_ref_teams=0)
        self._start(rid)
        self.client.post(
            f"/api/arena/rounds/{rid}/attack/",
            {"group_id": self.g1.id, "correct": True, "points": 60},
            format="json",
        )
        resp = self.client.post(
            f"/api/arena/rounds/{rid}/attack/",
            {"group_id": self.g2.id, "correct": True, "points": 50},
            format="json",
        )
        self.assertEqual(resp.data["status"], "ENDED")
        state = anon_client().get(f"/api/arena/rounds/{rid}/state/")
        self.assertEqual(state.data["outcome"], "VICTORY")
        saque = [
            e for e in state.data["events"]
            if e["kind"] == "REWARD" and "Saque do Chefe" in e["message"]
        ]
        self.assertEqual(len(saque), 2)  # uma por equipe
        self.assertTrue(any("golpe final" in e["message"] for e in saque))
        # Proporcional (45 + 450 rateados) + saque (500) sem duplicar
        lb = anon_client().get("/api/leaderboard/")
        pontos = {r["name"]: r["points"] for r in lb.data}
        self.assertGreater(pontos["Equipe Alfa"], 45)
        self.assertGreater(pontos["Equipe Beta"], 37)
        total_saque = sum(e["value"] for e in saque)
        self.assertEqual(total_saque, 500)

    def test_fuga_nao_rateia_saque(self):
        rid = self._create(treasure=500, balance_ref_teams=0)
        self._start(rid)
        self.client.post(
            f"/api/arena/rounds/{rid}/attack/",
            {"group_id": self.g1.id, "correct": True, "points": 40},
            format="json",
        )
        resp = self.client.post(f"/api/arena/rounds/{rid}/end/", {}, format="json")
        self.assertEqual(resp.data["outcome"], "RETREAT")
        state = anon_client().get(f"/api/arena/rounds/{rid}/state/")
        self.assertEqual(state.data["outcome"], "RETREAT")
        self.assertFalse(any(
            "Saque do Chefe" in e["message"] for e in state.data["events"]
        ))
        # só a recompensa proporcional (40 - 10 de retaliação)
        lb = anon_client().get("/api/leaderboard/")
        self.assertEqual(lb.data[0]["points"], 30)

    def test_ataque_padrao_escala_com_o_bando(self):
        rid = self._create(balance_ref_teams=4)  # 1 equipe -> ×2
        self._start(rid)
        self.client.post(
            f"/api/arena/rounds/{rid}/attack/",
            {"group_id": self.g1.id, "correct": True, "points": 100},
            format="json",
        )
        state = anon_client().get(f"/api/arena/rounds/{rid}/state/")
        team = state.data["teams"][0]
        self.assertEqual(team["battle_damage"], 200)
        self.assertEqual(team["retaliation_loss"], 50)
        self.assertEqual(state.data["hp"], 0)  # dano 200 > PV 100, zera
        self.assertEqual(state.data["outcome"], "VICTORY")

    def test_rematch_com_pv_inicial_do_chefe_em_fuga(self):
        resp = self.client.post(
            "/api/arena/rounds/",
            {"name": "Fuga", "boss": self.boss.id, "max_hp": 100,
             "initial_hp": 60},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["hp"], 60)
        # e sem initial_hp nasce cheio (M-41 mantido)
        resp = self.client.post(
            "/api/arena/rounds/",
            {"name": "Cheio", "boss": self.boss.id, "max_hp": 100},
            format="json",
        )
        self.assertEqual(resp.data["hp"], 100)

    def test_desfecho_fica_no_estado_apos_end(self):
        rid = self._create(balance_ref_teams=0)
        self._start(rid)
        self.client.post(
            f"/api/arena/rounds/{rid}/attack/",
            {"group_id": self.g1.id, "correct": True, "points": 10},
            format="json",
        )
        self.client.post(f"/api/arena/rounds/{rid}/end/", {}, format="json")
        round_obj = ArenaRound.objects.get(id=rid)
        self.assertEqual(round_obj.outcome, "RETREAT")


class ArenaTeamAbilityApiTests(TestCase):
    """Ações `use-ability` (d20 no servidor) e `renew-abilities` (ADR-019/021)."""

    def setUp(self):
        from unittest.mock import patch

        from apps.groups.models import GroupAbility, TeamAbilityTemplate

        self.patcher = patch("apps.arena.services._d20_roll", return_value=17)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

        self.boss = Boss.objects.create(name="Vigia", max_hp=10000)
        self.group = Group.objects.create(name="Equipe Alfa")
        self.templates = {}
        specs = [
            ("Golpe", "BASIC", "STRIKE", 100, 2),
            ("Cura", "BASIC", "HEAL", 40, 2),
            ("Escudo", "BASIC", "SHIELD", 60, 2),
            ("Ultimate", "ULTIMATE", "STRIKE", 500, 1),
        ]
        for name, kind, effect, value, charges in specs:
            template = TeamAbilityTemplate.objects.create(
                theme="Floresta", name=name, kind=kind, effect=effect,
                value=value, max_charges=charges,
            )
            self.templates[name] = GroupAbility.objects.create(
                group=self.group, template=template
            )
        self.client = staff_client()
        created = self.client.post(
            "/api/arena/rounds/",
            {"name": "Rodada", "boss": self.boss.id, "max_hp": 10000,
             "balance_ref_teams": 0},
            format="json",
        )
        self.rid = created.data["id"]
        self.client.post(f"/api/arena/rounds/{self.rid}/start/", {}, format="json")

    def _use(self, ability_name):
        return self.client.post(
            f"/api/arena/rounds/{self.rid}/use-ability/",
            {"group_id": self.group.id,
             "ability_id": self.templates[ability_name].id},
            format="json",
        )

    def _state(self):
        return anon_client().get(f"/api/arena/rounds/{self.rid}/state/")

    def test_estado_expoe_as_habilidades_da_equipe(self):
        state = self._state()
        team = state.data["teams"][0]
        self.assertEqual(len(team["abilities"]), 4)
        golpe = next(a for a in team["abilities"] if a["name"] == "Golpe")
        self.assertEqual(golpe["kind"], "BASIC")
        self.assertEqual(golpe["effect"], "STRIKE")
        self.assertEqual(golpe["value"], 100)
        self.assertEqual(golpe["charges_left"], 2)  # repostas no start

    def test_usar_habilidade_com_d20_do_servidor(self):
        resp = self._use("Golpe")
        self.assertEqual(resp.status_code, 200)
        state = self._state()
        team = state.data["teams"][0]
        self.assertEqual(team["battle_damage"], 100)  # roll 17 = normal
        golpe = next(a for a in team["abilities"] if a["name"] == "Golpe")
        self.assertEqual(golpe["charges_left"], 1)
        ev = next(e for e in state.data["events"] if e["kind"] == "ABILITY")
        self.assertEqual(ev["actor"], "TEAM")
        self.assertEqual(ev["roll"], 17)
        self.assertEqual(ev["ability_name"], "Golpe")
        self.assertEqual(ev["ability_id"], self.templates["Golpe"].id)

    def test_ultimate_gasta_a_unica_carga(self):
        self.assertEqual(self._use("Ultimate").status_code, 200)
        state = self._state()
        team = state.data["teams"][0]
        self.assertEqual(team["battle_damage"], 500)
        resp = self._use("Ultimate")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("sem cargas", str(resp.data))

    def test_habilidade_desconhecida_400(self):
        resp = self.client.post(
            f"/api/arena/rounds/{self.rid}/use-ability/",
            {"group_id": self.group.id, "ability_id": 999999},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_renovar_repoi_as_cargas(self):
        self._use("Golpe")
        self._use("Golpe")
        self.assertEqual(self._use("Golpe").status_code, 400)  # gastou as 2
        resp = self.client.post(
            f"/api/arena/rounds/{self.rid}/renew-abilities/",
            {"group_id": self.group.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        golpe = next(
            a for a in self._state().data["teams"][0]["abilities"]
            if a["name"] == "Golpe"
        )
        self.assertEqual(golpe["charges_left"], 2)

    def test_cura_e_escudo_refletem_no_estado(self):
        # mete retaliação pra cura ter efeito
        self.client.post(
            f"/api/arena/rounds/{self.rid}/attack/",
            {"group_id": self.group.id, "correct": True, "points": 200},
            format="json",
        )
        state = self._state()
        self.assertEqual(state.data["teams"][0]["retaliation_loss"], 50)
        self._use("Cura")  # roll 17 -> cura 40
        state = self._state()
        self.assertEqual(state.data["teams"][0]["retaliation_loss"], 10)
        self._use("Escudo")  # roll 17 -> escudo 60
        state = self._state()
        self.assertEqual(state.data["teams"][0]["shield"], 60)
