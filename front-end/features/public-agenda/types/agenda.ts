export type ScheduleSlot = { language: string; date: string } | null;

export type AgendaGroup = {
  id: string;
  name: string;
  members: { id: string; name: string; registration: string }[];
  schedule: ScheduleSlot[];
};
