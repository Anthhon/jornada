import { BookOpen, CalendarDays, Castle, Flame, KeyRound, ScrollText, Shield, Skull, Users } from "lucide-react";
import type { ComponentType } from "react";
import { Crest } from "@/features/journey/components/crest";

export type SidebarCounts = Partial<Record<"agenda" | "missions", number>>;

type SidebarItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  countKey?: keyof SidebarCounts;
  adminOnly?: boolean;
};

export const sidebarSections: { id: string; label: string; items: SidebarItem[] }[] = [
  { id: "game", label: "Jogo", items: [
    { href: "/schedule", label: "Agenda de incursões", icon: CalendarDays, countKey: "agenda" },
    { href: "/dashboard", label: "Salão da Guilda", icon: Castle },
    { href: "/missions", label: "Missões", icon: Crest, countKey: "missions" },
  ] },
  { id: "characters", label: "Personagens", items: [
    { href: "/students", label: "Aventureiros", icon: Users },
    { href: "/heroes", label: "Heróis", icon: Flame },
    { href: "/groups", label: "Grupos", icon: Shield },
  ] },
  { id: "content", label: "Conteúdo", items: [
    { href: "/skills", label: "Habilidades", icon: BookOpen },
    { href: "/bosses", label: "Chefes", icon: Skull },
    { href: "/questions", label: "Perguntas", icon: ScrollText },
  ] },
  { id: "admin", label: "Admin", items: [
    { href: "/users", label: "Usuários da API", icon: KeyRound, adminOnly: true },
  ] },
];
