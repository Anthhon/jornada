export interface Question {
  language?: string;
  id: string;
  statement: string;
  options: { text: string; correct: boolean }[];
}
