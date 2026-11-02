export interface Team {
  id: string;
  name: string;
  memberIds: string[];
  /** Pontos extras individuais por aluno */
  extraPoints: Record<string, number>;
}
