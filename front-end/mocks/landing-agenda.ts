import type { AgendaGroup } from "@/features/public-agenda/types/agenda";

export const missions = [
  { id: "i1", number: 1, title: "O Despertar dos Paradigmas" },
  { id: "i2", number: 2, title: "A Travessia Funcional" },
  { id: "i3", number: 3, title: "O Enigma Lógico" },
];

export const groups: AgendaGroup[] = [
  {
    id: "t1",
    name: "Lâmina de Prata",
    members: [
      { id: "s1", name: "Ana Souza", registration: "558001" },
      { id: "s2", name: "Bruno Lima", registration: "558002" },
      { id: "s3", name: "Carla Mendes", registration: "558003" },
    ],
    schedule: [
      { language: "C", date: "2026-09-14" },
      null,
      { language: "Prolog", date: "2026-11-16" },
    ],
  },
  {
    id: "t2",
    name: "Corvos do Norte",
    members: [
      { id: "s4", name: "Diego Rocha", registration: "558004" },
      { id: "s5", name: "Elisa Prado", registration: "558005" },
      { id: "s6", name: "Felipe Nunes", registration: "558006" },
    ],
    schedule: [
      { language: "Pascal", date: "2026-09-14" },
      { language: "Haskell", date: "2026-10-26" },
      null,
    ],
  },
  {
    id: "t3",
    name: "Guardiões do Vale",
    members: [
      { id: "s7", name: "Gabriela Torres", registration: "558007" },
      { id: "s8", name: "Henrique Alves", registration: "558008" },
      { id: "s9", name: "Isabela Costa", registration: "558009" },
    ],
    schedule: [
      { language: "Fortran", date: "2026-09-14" },
      { language: "Elixir", date: "2026-10-26" },
      { language: "Datalog", date: "2026-11-16" },
    ],
  },
  {
    id: "t4",
    name: "Chama Errante",
    members: [
      { id: "s10", name: "João Batista", registration: "558010" },
      { id: "s11", name: "Larissa Pinto", registration: "558011" },
      { id: "s12", name: "Mateus Ferreira", registration: "558012" },
    ],
    schedule: [
      null,
      { language: "Lisp", date: "2026-10-26" },
      { language: "Mercury", date: "2026-11-16" },
    ],
  },
];
