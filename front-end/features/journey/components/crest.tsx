"use client";

import { cn } from "@/lib/utils";

/** Brasão da guilda */
export function Crest({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 44" className={cn("h-9 w-9", className)} aria-hidden>
      <path d="M20 2 L37 8 V21 C37 31 29 38 20 42 C11 38 3 31 3 21 V8 Z" className="fill-primary stroke-foreground" strokeWidth="1.4" />
      <path d="M20 6 L33 10.5 V21 C33 29 27 34.5 20 38 C13 34.5 7 29 7 21 V10.5 Z" fill="none" className="stroke-accent-foreground" strokeWidth="0.9" />
      <path d="M14 28 L26 14 M26 28 L14 14" className="stroke-foreground" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="20" cy="21" r="2.4" className="fill-card stroke-foreground" strokeWidth="1.1" />
    </svg>
  );
}
