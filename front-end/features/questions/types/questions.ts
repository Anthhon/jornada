export interface Question {
  id: string;
  statement: string;
  options: { text: string; correct: boolean }[];
}
