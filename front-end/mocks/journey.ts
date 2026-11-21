import type { Boss, BossSkill } from "@/features/bosses";
import type { Hero } from "@/features/heroes";
import type { Incursion } from "@/features/missions";
import type { Question } from "@/features/questions";
import type { Skill } from "@/features/skills";
import type { Student } from "@/features/students";
import type { Team } from "@/features/groups";
import { makeStages } from "@/lib/journey/stages";


const names = [
  "Ana Souza",
  "Bruno Lima",
  "Carla Mendes",
  "Diego Rocha",
  "Elisa Prado",
  "Felipe Nunes",
  "Gabriela Torres",
  "Henrique Alves",
  "Isabela Costa",
  "João Batista",
  "Larissa Pinto",
  "Mateus Ferreira",
];

export const seedStudents: Student[] = names.map((name, i) => ({
  id: `s${i + 1}`,
  name,
  registration: String(558001 + i),
}));

export const seedTeams: Team[] = [
  { id: "t1", name: "Lâmina de Prata", memberIds: ["s1", "s2", "s3"], extraPoints: { s1: 0.5 } },
  { id: "t2", name: "Corvos do Norte", memberIds: ["s4", "s5", "s6"], extraPoints: {} },
  { id: "t3", name: "Guardiões do Vale", memberIds: ["s7", "s8", "s9"], extraPoints: {} },
  { id: "t4", name: "Chama Errante", memberIds: ["s10", "s11", "s12"], extraPoints: {} },
];

export const seedSkills: Skill[] = [
  { id: "k1", name: "Torrente Sábia", cost: 2, type: "dano", dice: "1d10", effect: "Rola 1d10 de dano no chefe para cada ponto conseguido em Histórico ou Características do Paradigma, considerando o maior entre os dois." },
  { id: "k2", name: "Raízes Protetoras", cost: 3, type: "escudo", dice: "2d10", effect: "Cria uma barreira guardada; qualquer penalidade do chefe é absorvida por esse valor antes de afetar o Dano Base da Aliança." },
  { id: "k3", name: "Equilíbrio Selvagem", cost: 5, type: "suporte", dice: "—", effect: "A Aliança escolhe: ignorar a penalidade de Tempo do chefe, ou recuperar os pontos de ação de uma equipe aliada que já agiu." },
  { id: "k4", name: "Palavras de Incentivo", cost: 2, type: "cura", dice: "1d10", effect: "Preenche pontos perdidos por penalidade em Criatividade ou Tempo, somando ao dano da Aliança." },
  { id: "k5", name: "Canção de Foco", cost: 3, type: "escudo", dice: "2d10", effect: "Reduz o impacto das perguntas erradas na Fase 2, pagando a penalidade do chefe por respostas incorretas." },
  { id: "k6", name: "Inspiração Épica", cost: 5, type: "dano", dice: "2d10", effect: "2d10 de dano para cada equipe com valor máximo em Criatividade; +3d6 se todas as equipes atingirem o máximo." },
  { id: "k7", name: "Fúria Básica", cost: 2, type: "dano", dice: "1d12+5", effect: "A adrenalina do combate: 1d12 + 5 de dano extra no chefe." },
  { id: "k8", name: "Golpe Imprudente", cost: 3, type: "dano", dice: "3d12", effect: "3d12 de dano extra. Se o chefe penalizar essa equipe, a Aliança perde +5 de dano além da penalidade." },
  { id: "k9", name: "Frenesi de Batalha", cost: 5, type: "dano", dice: "5d12", effect: "A maior explosão de dano bruto de todas as classes: 5d12 direto no chefe." },
  { id: "k10", name: "Purificação", cost: 2, type: "cura", dice: "1d10", effect: "Recupera pontos perdidos em um critério onde a equipe tirou apenas Satisfatório, somando ao dano." },
  { id: "k11", name: "Escudo Sagrado", cost: 3, type: "escudo", dice: "2d10", effect: "Amortece diretamente o impacto de uma penalidade do chefe." },
  { id: "k12", name: "Intervenção Divina", cost: 5, type: "escudo", dice: "3d10", effect: "Anula integralmente uma penalidade do chefe e distribui o valor rolado para cobrir penalidades da rubrica." },
  { id: "k13", name: "Ataque Preciso", cost: 2, type: "dano", dice: "1d10", effect: "1d10 de dano extra; +1d4 para cada equipe com valor máximo em Uso da Linguagem." },
  { id: "k14", name: "Golpe Demolidor", cost: 3, type: "dano", dice: "2d10", effect: "Um ataque pesado contra a estrutura do inimigo: 2d10 de dano extra." },
  { id: "k15", name: "Mestre de Armas", cost: 5, type: "dano", dice: "4d10", effect: "4d10 que ignoram qualquer escudo ou penalidade e vão direto para a vida do chefe." },
  { id: "k16", name: "Ataque Furtivo", cost: 2, type: "dano", dice: "2d10", effect: "Se a equipe tirou Muito Satisfatório em Criatividade, rola 2d10 de dano crítico." },
  { id: "k17", name: "Reação Rápida", cost: 3, type: "dano", dice: "3d10", effect: "Se o chefe aplicar penalidade na equipe, o Ladino contra-ataca com 3d10 de dano." },
  { id: "k18", name: "Golpe de Risco", cost: 5, type: "dano", dice: "3d10", effect: "Tudo ou nada: se a soma passar de 15, o dano da apresentação recebe multiplicador 1,5x; senão soma só o rolado." },
];

const review = "[revisar] Passiva não informada nos slides.";

export const seedHeroes: Hero[] = [
  { id: "h1", name: "Jasper", heroClass: "Druida", role: "Suporte", description: "Sabedoria ancestral sem limites. Não luta com força, mas com o poder da natureza, adaptando-se ao campo de batalha.", passive: "Se atingir nota máxima em Histórico, a equipe recebe +1 ponto de Mana.", attributes: { forca: 2, sabedoria: 5, carisma: 3 }, skillIds: ["k1", "k2", "k3"] },
  { id: "h2", name: "Emy", heroClass: "Barda", role: "Suporte", description: "A mestre do suporte tático. Inspira os aliados a superarem erros de apresentação e reduz o peso das falhas sob pressão.", passive: review, passiveReview: true, attributes: { forca: 1, sabedoria: 3, carisma: 5 }, skillIds: ["k4", "k5", "k6"] },
  { id: "h3", name: "Allya", heroClass: "Bárbara", role: "Ataque", description: "Força bruta sem limites. Não pensa em defesa, apenas em causar a maior destruição possível antes do tempo acabar.", passive: review, passiveReview: true, attributes: { forca: 5, sabedoria: 1, carisma: 2 }, skillIds: ["k7", "k8", "k9"] },
  { id: "h4", name: "Kassi", heroClass: "Clériga", role: "Suporte", description: "O escudo divino da Aliança. Especializada em bloquear as mecânicas punitivas do chefe e salvar a pontuação base.", passive: review, passiveReview: true, attributes: { forca: 2, sabedoria: 4, carisma: 4 }, skillIds: ["k10", "k11", "k12"] },
  { id: "h5", name: "Cillian", heroClass: "Guerreiro", role: "Ataque", description: "O mestre da constância e das táticas de combate. Dano seguro, confiável e focado nas aberturas do chefe.", passive: review, passiveReview: true, attributes: { forca: 4, sabedoria: 3, carisma: 2 }, skillIds: ["k13", "k14", "k15"] },
  { id: "h6", name: "Kovu", heroClass: "Ladino", role: "Ataque", description: "O especialista em explorar falhas e golpear pontos fracos. Depende do desempenho em critérios específicos.", passive: review, passiveReview: true, attributes: { forca: 3, sabedoria: 3, carisma: 3 }, skillIds: ["k16", "k17", "k18"] },
];

/** Habilidade com os padrões do seed do back (`seed_chefes`, ADR-017). */
function skill(
  spec: Pick<BossSkill, "name" | "trigger" | "effect" | "value" | "description"> &
    Partial<Pick<BossSkill, "every" | "threshold" | "mode" | "scope" | "min_count">>,
): BossSkill {
  return { every: 1, threshold: 3, mode: "ANY", scope: "TEAM", min_count: 1, ...spec };
}

export const seedBosses: Boss[] = [
  {
    id: "b1", name: "Mothman, o Sábio", hp: 150, specialty: "Penalidades por tempo e conceito",
    description: "Enfraquece o dano da Aliança diante de falhas em tempo, conceitos e perguntas.",
    active: true, image: "/personagens/mothman.jpg", skills: [
      skill({ name: "Olhar Hipnótico", trigger: "TEMPO", effect: "PENALTY", value: 10, description: "Se a equipe não atingir a nota máxima em Tempo, a Aliança perde 10 pontos de Dano Base." }),
      skill({ name: "Asas de Sombras", trigger: "CONCEITO", effect: "CUT", value: 50, threshold: 2, scope: "ALLIANCE", min_count: 2, description: "Se mais de uma equipe tirar Parcial ou Ausente em Paradigma ou Características, o dano extra dela é cortado pela metade." }),
      skill({ name: "Enxame Noturno", trigger: "PERGUNTAS", effect: "PENALTY", value: 10, every: 2, description: "A cada duas perguntas erradas, a Aliança perde 10 pontos de Dano Base." }),
    ]
  },
  {
    id: "b2", name: "Rei Rato", hp: 150, specialty: "Pune tempo, conceitos e cada erro",
    description: "Penaliza falhas de tempo, conceitos e respostas durante a apresentação e a arguição.",
    active: true, image: "/personagens/rei-rato.jpg", skills: [
      skill({ name: "Olhar Hipnótico", trigger: "TEMPO", effect: "PENALTY", value: 10, description: "Se a equipe não atingir a nota máxima em Tempo, a Aliança perde 10 pontos de Dano Base." }),
      skill({ name: "Asas de Sombras", trigger: "CONCEITO", effect: "CUT", value: 50, threshold: 2, scope: "ALLIANCE", min_count: 1, description: "Se ao menos uma equipe tirar Parcial ou Ausente em Paradigma ou Características, o dano extra dela é cortado pela metade." }),
      skill({ name: "Enxame Noturno", trigger: "PERGUNTAS", effect: "PENALTY", value: 7, description: "A cada pergunta errada, a Aliança perde 7 pontos de Dano Base." }),
    ]
  },
  {
    id: "b3", name: "Leshy", hp: 130, specialty: "Recupera PV com fundamentos fracos",
    description: "Recupera vida com falhas em fundamentos e perguntas erradas; confunde quem erra a demonstração.",
    active: true, image: "/personagens/leshy.jpg", skills: [
      skill({ name: "Raízes do Passado", trigger: "FUNDAMENTOS", effect: "HEAL", value: 5, description: "Se a equipe tirar menos que a nota máxima em Histórico ou Paradigma, Leshy ganha imediatamente +5 PV." }),
      skill({ name: "Esporos Confusos", trigger: "DEMONSTRACAO", effect: "DISADV", value: 50, description: "Sem a nota máxima em Principais Usos ou código, o dano extra dessa equipe é reduzido em 50% (desvantagem)." }),
      skill({ name: "Fungo do Dreno", trigger: "PERGUNTAS", effect: "HEAL", value: 5, description: "A cada pergunta errada na Fase 2, Leshy recupera 5 PV." }),
    ]
  },
  {
    id: "b4", name: "A Sombra Espreitadora", hp: 130, specialty: "Drena dano e rouba PV",
    description: "Drena dano da Aliança, ganha vida com falhas e enfraquece os dados extras de quem erra a demonstração.",
    active: true, image: "/personagens/sombra-espreitadora.jpg", skills: [
      skill({ name: "Dreno de Vitalidade", trigger: "FUNDAMENTOS", effect: "HEAL", value: 5, description: "Se a equipe tirar menos que a nota máxima em Histórico ou Paradigma, a Sombra recupera +5 PV." }),
      skill({ name: "Emboscada nas Sombras", trigger: "DEMONSTRACAO", effect: "CUT", value: 50, description: "Sem a nota máxima em Principais Usos ou código, o dano extra dessa equipe é cortado pela metade." }),
      skill({ name: "Ataque do Saqueador", trigger: "PERGUNTAS", effect: "DRAIN", value: 5, description: "A cada pergunta errada, drena 5 de Dano Base da Aliança e soma ao próprio HP." }),
    ]
  },
  {
    id: "b5", name: "O Colecionador de Ossos", hp: 130, specialty: "Punições amplas pela média da rubrica",
    description: "Reduz o Dano Base da Aliança com notas baixas e impõe desvantagem no Tempo; pune cada erro.",
    active: true, image: "/personagens/colecionador-de-ossos.jpg", skills: [
      skill({ name: "Sopro de Ácido", trigger: "GERAL", effect: "PENALTY", value: 5, mode: "AVERAGE", threshold: 1, description: "Se a média dos critérios ficar abaixo de Satisfatório, a Aliança perde 5 pontos de Dano Base." }),
      skill({ name: "Rajada de Vento", trigger: "TEMPO", effect: "DISADV", value: 50, description: "Se a equipe não atingir a nota máxima em Tempo, seus dados extras de dano são reduzidos em 50% (desvantagem)." }),
      skill({ name: "Rugido do Medo", trigger: "PERGUNTAS", effect: "PENALTY", value: 10, description: "A cada pergunta errada, a Aliança perde 10 pontos de Dano Base." }),
    ]
  },
  {
    id: "b6", name: "O Colecionador de Faces", hp: 130, specialty: "Confunde equipes e encarece o suporte",
    description: "Castiga notas variadas e cada pergunta errada; encarece o suporte da Aliança.",
    active: true, image: "/personagens/colecionador-de-faces.jpg", skills: [
      skill({ name: "Máscara da Confusão", trigger: "GERAL", effect: "PENALTY", value: 5, mode: "SPREAD", threshold: 2, description: "Com notas muito variadas (2 níveis ou mais de diferença), a Aliança perde 5 pontos de Dano Base." }),
      skill({ name: "Máscara da Discórdia", trigger: "SUPORTE", effect: "PR_COST", value: 2, description: "Habilidades de suporte custam 2 PR a mais (informativo: a raid ainda não usa o sistema de PR)." }),
      skill({ name: "Máscara do Silêncio", trigger: "PERGUNTAS", effect: "PENALTY", value: 5, description: "A cada pergunta errada, a Aliança perde 5 pontos de Dano Base." }),
    ]
  },
  {
    id: "b7", name: "O Mago Corrompido", hp: 200, specialty: "O chefão: castiga todas as equipes de uma vez",
    description: "Boss especial: surge quando os heróis repetem a mesma classe 4 vezes seguidas. Distorce os dados de dano e pune erros.",
    active: false, image: "/personagens/mago-corrompido.jpg", skills: [
      skill({ name: "Distorção Temporal", trigger: "TEMPO", effect: "DISADV", value: 50, scope: "ALLIANCE", min_count: 1, description: "Se a média de Tempo das equipes ficar abaixo da nota máxima, todas afetadas sofrem desvantagem no dano extra." }),
      skill({ name: "Cegueira das Sombras", trigger: "CONCEITO", effect: "DISADV", value: 50, description: "Sem a nota máxima em Paradigma ou Características, o dano extra da equipe é reduzido em 50%." }),
      skill({ name: "Aniquilação da Alma", trigger: "PERGUNTAS", effect: "DRAIN", value: 5, description: "A cada pergunta errada, drena 5 de Dano Base e soma ao próprio HP." }),
    ]
  },
];

export const seedQuestions: Question[] = [
  {
    id: "q1", statement: "Qual paradigma trata a computação como avaliação de funções matemáticas?", options: [
      { text: "Imperativo", correct: false }, { text: "Funcional", correct: true }, { text: "Orientado a objetos", correct: false }, { text: "Lógico", correct: false }]
  },
  {
    id: "q2", statement: "Em qual linguagem o código é organizado em fatos e regras?", options: [
      { text: "Prolog", correct: true }, { text: "C", correct: false }, { text: "Java", correct: false }]
  },
  {
    id: "q3", statement: "Qual característica define o encapsulamento?", options: [
      { text: "Esconder detalhes internos de um objeto", correct: true }, { text: "Executar código em paralelo", correct: false }, { text: "Compilar para bytecode", correct: false }]
  },
  {
    id: "q4", statement: "Qual destas linguagens é multiparadigma?", options: [
      { text: "Haskell", correct: false }, { text: "Python", correct: true }, { text: "Assembly", correct: false }]
  },
  {
    id: "q5", statement: "O que é uma função de alta ordem?", options: [
      { text: "Uma função que recebe ou retorna outra função", correct: true }, { text: "Uma função recursiva", correct: false }, { text: "Uma função sem retorno", correct: false }]
  },
];

const ev = (t: number, h: number, p: number, c: number, u: number, co: number, cr: number, correct: number) => ({
  correct,
  criteria: { tempo: t, historico: h, paradigma: p, caracteristicas: c, usos: u, codigo: co, criatividade: cr } as never,
});

export const seedIncursions: Incursion[] = [
  {
    id: "i1", number: 1, title: "O Despertar dos Paradigmas", date: "2026-09-14", paradigm: "Imperativo", questionsPerStage: 5,
    status: "concluida", result: "vitoria", bossId: "b1",
    teams: [
      { teamId: "t1", language: "C", heroId: "h3", evaluation: ev(3, 3, 3, 1, 3, 3, 3, 4) },
      { teamId: "t2", language: "Pascal", heroId: "h4", evaluation: ev(1, 3, 1, 3, 3, 1, 3, 3) },
      { teamId: "t3", language: "Fortran", heroId: "h1", evaluation: ev(3, 3, 3, 3, 1, 3, 1, 5) },
    ],
    stages: makeStages(["t1", "t2", "t3"]).map((s, i) => ({ ...s, status: "concluida", startedAt: `2026-09-14T${String(19 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`, endedAt: `2026-09-14T${String(19 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "55" : "25"}` })),
    turns: [
      { id: "u1", actor: "t1", skillName: "Frenesi de Batalha", roll: "5d12 → 9, 4, 11, 7, 6", value: 37, effect: "dano" },
      { id: "u2", actor: "chefe", skillName: "Olhar Hipnótico", roll: "—", value: 10, effect: "penalidade" },
      { id: "u3", actor: "t2", skillName: "Escudo Sagrado", roll: "2d10 → 8, 5", value: 13, effect: "escudo" },
      { id: "u4", actor: "t3", skillName: "Torrente Sábia", roll: "3d10 → 9, 10, 7", value: 26, effect: "dano" },
      { id: "u5", actor: "t1", skillName: "Dano Base da apresentação", roll: "—", value: 90, effect: "dano" },
    ],
  },
  {
    id: "i2", number: 2, title: "A Travessia Funcional", date: "2026-10-26", paradigm: "Funcional", questionsPerStage: 5,
    status: "andamento", result: null, bossId: null,
    teams: [
      { teamId: "t2", language: "Haskell", heroId: "h5", evaluation: ev(3, 3, 3, 3, 3, 1, 3, 4) },
      { teamId: "t3", language: "Elixir", heroId: "h2", evaluation: null },
      { teamId: "t4", language: "Lisp", heroId: null, evaluation: null },
    ],
    stages: makeStages(["t2", "t3", "t4"]).map((s, i) =>
      i === 0 ? { ...s, status: "concluida", startedAt: "2026-10-26T19:00", endedAt: "2026-10-26T19:25" }
        : i === 1 ? { ...s, status: "andamento", startedAt: "2026-10-26T19:30" } : s),
    turns: [],
  },
  {
    id: "i3", number: 3, title: "O Enigma Lógico", date: "2026-11-16", paradigm: "Lógico", questionsPerStage: 5,
    status: "planejada", result: null, bossId: null,
    teams: [
      { teamId: "t1", language: "Prolog", heroId: null, evaluation: null },
      { teamId: "t3", language: "Datalog", heroId: null, evaluation: null },
      { teamId: "t4", language: "Mercury", heroId: null, evaluation: null },
    ],
    stages: makeStages(["t1", "t3", "t4"]),
    turns: [],
  },
];
