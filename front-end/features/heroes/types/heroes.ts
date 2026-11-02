export interface Hero {
  id: string;
  name: string;
  heroClass: string;
  role: "Ataque" | "Suporte";
  description: string;
  passive: string;
  passiveReview?: boolean;
  attributes: { forca: number; sabedoria: number; carisma: number };
  skillIds: string[];
}
