"use client";

import { cn } from "@/lib/utils";
import { GoldenApple } from "@/components/icons/rpg-icons";

/** Maçã dourada da guilda, desenhada em uma grade de pixels. */
export function Crest({ className }: { className?: string }) {
  return (
    <GoldenApple className={cn("h-9 w-9", className)} />
  );
}
