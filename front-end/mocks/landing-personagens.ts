export const heroes = [
  {
    "name": "Jasper — Druida",
    "image": "/personagens/jasper.jpg",
    "intro": "suporte que usa a natureza e a adaptação para proteger a Aliança e controlar o combate.",
    "items": [
      {
        "name": "Passiva secreta",
        "description": "ao atingir nota máxima em Histórico, a equipe recebe +1 ponto de Mana."
      },
      {
        "name": "Torrente Sábia (2)",
        "description": "causa 1d10 de dano no chefe por ponto obtido em Histórico ou Características do Paradigma, considerando o maior dos dois."
      },
      {
        "name": "Raízes Protetoras (3)",
        "description": "rola 2d10 e guarda o resultado como barreira. Penalidades do chefe são absorvidas por esse valor antes de afetarem o Dano Base da Aliança."
      },
      {
        "name": "Equilíbrio Selvagem (5)",
        "description": "a Aliança escolhe entre ignorar completamente a penalidade de Tempo do boss ou recuperar os pontos de ação de uma equipe aliada que já agiu para o nível máximo."
      }
    ]
  },
  {
    "name": "Emy — Barda",
    "image": "/personagens/emy.jpg",
    "intro": "suporte tático que inspira aliados e reduz o impacto de falhas de apresentação e perguntas.",
    "items": [
      {
        "name": "Palavras de Incentivo (2)",
        "description": "rola 1d10 para preencher pontos perdidos se a equipe tiver sido penalizada em Criatividade da Apresentação ou Tempo, somando o valor ao dano da Aliança."
      },
      {
        "name": "Canção de Foco (3)",
        "description": "rola 2d10; cada ponto ajuda a pagar a penalidade do debuff do boss por respostas incorretas na Fase 2."
      },
      {
        "name": "Inspiração Épica (5)",
        "description": "causa 2d10 de dano no boss por equipe da Aliança que atingiu o valor máximo em Criatividade. Recebe 3d6 adicionais se todas as equipes da Aliança atingiram esse valor máximo."
      }
    ]
  },
  {
    "name": "Allya — Bárbara",
    "image": "/personagens/allya.jpg",
    "intro": "ataque de força bruta, voltado a causar o máximo de destruição.",
    "items": [
      {
        "name": "Fúria Básica (2)",
        "description": "causa 1d12 + 5 de dano extra no boss."
      },
      {
        "name": "Golpe Imprudente (3)",
        "description": "causa 3d12 de dano extra. Se o boss atacar essa equipe com penalidades, elas subtraem, além da penalidade, mais 5 do dano da Aliança."
      },
      {
        "name": "Frenesi de Batalha (5)",
        "description": "causa 5d12 de dano direto no boss."
      }
    ]
  },
  {
    "name": "Kassi — Clériga",
    "image": "/personagens/kassi.jpg",
    "intro": "suporte que bloqueia mecânicas punitivas do boss e protege a pontuação base.",
    "items": [
      {
        "name": "Purificação (2)",
        "description": "rola 1d10 para recuperar pontos perdidos em um critério no qual a equipe tirou apenas Satisfatório, somando-os ao dano."
      },
      {
        "name": "Escudo Sagrado (3)",
        "description": "rola 2d10 para amortecer diretamente um debuff do boss. Exemplo da fonte: uma penalidade de 20 e uma rolagem de 15 resultam em perda de 5 pontos de dano."
      },
      {
        "name": "Intervenção Divina (5)",
        "description": "anula integralmente um debuff do boss e rola 3d10; o resultado é distribuído para cobrir penalidades da rubrica de qualquer equipe da Aliança e aumentar seu dano."
      }
    ]
  },
  {
    "name": "Cillian — Guerreiro",
    "image": "/personagens/cillian.jpg",
    "intro": "ataque constante e tático, que aproveita as aberturas do chefe.",
    "items": [
      {
        "name": "Ataque Preciso (2)",
        "description": "causa 1d10 de dano extra no boss, com 1d4 adicional por equipe que atingiu o valor máximo na apresentação do Uso da Linguagem."
      },
      {
        "name": "Golpe Demolidor (3)",
        "description": "causa 2d10 de dano extra."
      },
      {
        "name": "Mestre de Armas (5)",
        "description": "causa 4d10 diretamente na vida do chefão, ignorando qualquer escudo ou penalidade."
      }
    ]
  },
  {
    "name": "Kovu — Ladino",
    "image": "/personagens/kovu-enviado.png",
    "intro": "ataque que explora falhas e pontos fracos, condicionado ao desempenho em critérios específicos.",
    "items": [
      {
        "name": "Ataque Furtivo (2)",
        "description": "se a equipe tirou Muito Satisfatório em Criatividade, causa 2d10 de dano crítico."
      },
      {
        "name": "Reação Rápida (3)",
        "description": "se o boss aplicar qualquer penalidade à equipe, por tempo ou perguntas erradas, causa 3d10 de dano em contra-ataque."
      },
      {
        "name": "Golpe de Risco (5)",
        "description": "rola 3d10. Se a soma for maior que 15, o dano total da apresentação da equipe recebe multiplicador de 1,5x; se for 15 ou menos, soma apenas o valor rolado."
      }
    ]
  }
];

export const bosses = [
  {
    "name": "Mothman: the wise",
    "image": "/personagens/mothman.jpg",
    "summary": "Enfraquece o dano da Aliança diante de falhas em tempo, conceitos e perguntas.",
    "intro": "HP: 150.",
    "items": [
      {
        "name": "Olhar Hipnótico — Tempo",
        "description": "se a equipe não atingir a nota máxima em Tempo da apresentação, a Aliança perde 10 pontos de Dano Base total."
      },
      {
        "name": "Asas de Sombras — Conceito",
        "description": "se mais de uma equipe tirar Satisfatório ou Insatisfatório nos critérios de Características ou Paradigma, qualquer dano extra rolado em d10 por essa equipe é cortado pela metade."
      },
      {
        "name": "Enxame Noturno — Perguntas",
        "description": "a cada duas perguntas erradas, a Aliança perde a chance de ganhar o recurso e perde 10 pontos de Dano Base."
      }
    ]
  },
  {
    "name": "Rei Rato",
    "image": "/personagens/rei-rato.jpg",
    "summary": "Penaliza falhas de tempo, conceitos e respostas, reduzindo o dano da Aliança.",
    "intro": "HP: 150.",
    "items": [
      {
        "name": "Olhar Hipnótico — Tempo",
        "description": "se a equipe não atingir a nota máxima em Tempo da apresentação, a Aliança perde 10 pontos de Dano Base total."
      },
      {
        "name": "Asas de Sombras — Conceito",
        "description": "se ao menos uma equipe tirar Satisfatório ou Insatisfatório nos critérios de Características ou Paradigma, qualquer dano extra em d10 rolado por essa equipe é cortado pela metade."
      },
      {
        "name": "Enxame Noturno — Perguntas",
        "description": "por cada pergunta errada, a Aliança perde a chance de ganhar o recurso e perde 7 pontos de Dano Base."
      }
    ]
  },
  {
    "name": "Leshy",
    "image": "/personagens/leshy.jpg",
    "summary": "Recupera vida com falhas em fundamentos e perguntas e impõe desvantagem aos dados.",
    "intro": "HP: 130.",
    "items": [
      {
        "name": "Raízes do Passado — Fundamentos",
        "description": "se a equipe tirar menos que Muito Satisfatório em Histórico ou Paradigma, Leshy ganha imediatamente +5 HP."
      },
      {
        "name": "Esporos Confusos — Demonstração",
        "description": "se a equipe não atingir a nota máxima em Principais Usos, cada dado extra de dano d10 dessa equipe é rolado com Desvantagem: rolam-se dois dados e mantém-se o menor."
      },
      {
        "name": "Fungo do Dreno — Perguntas",
        "description": "por cada pergunta errada na Fase 2, Leshy recupera 5 HP."
      }
    ]
  },
  {
    "name": "Sombra Espreitadora",
    "image": "/personagens/sombra-espreitadora.jpg",
    "summary": "Drena dano, ganha vida e enfraquece dados extras diante de falhas da Aliança.",
    "intro": "HP: 130.",
    "items": [
      {
        "name": "Dreno de Vitalidade — Fundamentos",
        "description": "se a equipe tirar menos que Muito Satisfatório em Histórico ou Paradigma, a Sombra ganha imediatamente +5 HP temporários."
      },
      {
        "name": "Emboscada nas Sombras — Demonstração",
        "description": "se a equipe não atingir a nota máxima em Principais Usos ou na apresentação do código, qualquer dado extra de dano d10 de qualquer equipe da Aliança tem o resultado cortado pela metade."
      },
      {
        "name": "Ataque do Saqueador — Perguntas",
        "description": "por cada pergunta errada na Fase 2, drena 5 pontos de Dano Base da Aliança e adiciona o mesmo valor ao próprio HP."
      }
    ]
  },
  {
    "name": "Colecionador de Ossos",
    "image": "/personagens/colecionador-de-ossos.jpg",
    "summary": "Reduz o Dano Base e impõe desvantagem por falhas de pontuação, tempo e perguntas.",
    "intro": "HP: 130.",
    "items": [
      {
        "name": "Sopro de Ácido — Geral",
        "description": "se a pontuação base da Aliança não for alta o suficiente — exemplo da fonte: média dos critérios abaixo de Satisfatório — reduz o Dano Base total em 5 pontos."
      },
      {
        "name": "Rajada de Vento — Tempo",
        "description": "se a equipe não atingir a nota máxima em Tempo, seus dados extras de dano d10 são rolados com Desvantagem: dois dados, mantendo o menor."
      },
      {
        "name": "Rugido do Medo — Perguntas",
        "description": "por cada pergunta errada na Fase 2, a Aliança não ganha o recurso e perde 10 pontos de Dano Base."
      }
    ]
  },
  {
    "name": "Colecionador de Faces",
    "image": "/personagens/colecionador-de-faces.jpg",
    "summary": "Reduz dano e encarece habilidades de suporte com suas máscaras.",
    "intro": "HP: 130.",
    "items": [
      {
        "name": "Máscara da Confusão — Geral",
        "description": "se a Aliança tiver critérios com notas variadas, descritos na fonte como “muitos Satisfatórios misturados com Alguns Satisfatórios”, reduz o Dano Base total em 5 pontos."
      },
      {
        "name": "Máscara da Discórdia — Suporte",
        "description": "uma equipe aliada é marcada; qualquer habilidade de suporte de Clérigo, Druida ou Bardo usada para ajudá-la custa 2 PR (Pontos de Recurso) a mais que o normal."
      },
      {
        "name": "Máscara do Silêncio — Perguntas",
        "description": "por cada pergunta errada na Fase 2, a Aliança não ganha o recurso e perde 5 pontos de Dano Base."
      }
    ]
  },
  {
    "name": "Mago Corrompido",
    "image": "/personagens/mago-corrompido.jpg",
    "summary": "Distorce dados de dano e pune erros nas perguntas com drenagem e selamento.",
    "intro": "HP: 200. Surge quando os heróis repetem 4 vezes seguidas uma classe.",
    "items": [
      {
        "name": "Distorção Temporal — Tempo",
        "description": "se a média dos critérios de Tempo das equipes for inferior a Muito Satisfatório, todas as equipes devem rolar novamente qualquer dado extra de dano d10 obtido naquele turno, mantendo obrigatoriamente o menor resultado."
      },
      {
        "name": "Cegueira das Sombras",
        "description": "se a equipe não atingir a nota máxima em Características Principais da Linguagem, qualquer dado extra d10 de qualquer equipe da Aliança é rolado com Desvantagem: rolam-se dois e mantém-se o menor."
      },
      {
        "name": "Aniquilação da Alma",
        "description": "por cada pergunta errada na arguição da Fase 2, a Aliança não ganha o recurso, o Mago drena 5 de Dano Base e escolhe uma equipe da Aliança para ser selada se tiver acertado menos de 4 perguntas."
      }
    ]
  }
];
