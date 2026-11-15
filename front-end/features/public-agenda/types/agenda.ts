export type ScheduleSlot = { language: string; date: string } | null;

export type AgendaSchedule = [ScheduleSlot, ScheduleSlot, ScheduleSlot];

export type AgendaMission = {
  id: string;
  number: 1 | 2 | 3;
  title: string;
};

export type AgendaMember = {
  id: string;
  name: string;
  registration: string;
};

export type AgendaGroup = {
  id: string;
  name: string;
  letter?: string;
  members: AgendaMember[];
  schedule: AgendaSchedule;
};

export type PublicAgenda = {
  missions: [AgendaMission, AgendaMission, AgendaMission];
  groups: AgendaGroup[];
};

export type PublicAgendaErrorCode =
  | "invalid_payload"
  | "unauthenticated"
  | "forbidden"
  | "unavailable";

export type PublicAgendaError = {
  code: PublicAgendaErrorCode;
  detail: string;
};
