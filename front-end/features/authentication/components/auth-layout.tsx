import Image from "next/image";
import type { ReactNode } from "react";
import { Crest } from "@/features/journey/components/crest";

export function AuthLayout({ children, title = "Debuggers & Developers", subtitle = "Área do professor", description = "" }: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  description?: string;
}) {
  return (
    <main className="relative z-10 grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-guild-gold/30 bg-guild-stone p-12 text-guild-ink lg:flex lg:min-h-svh lg:flex-col lg:justify-between xl:p-16">
        <Image src="/guild-hall.jpg" alt="" fill sizes="(min-width: 1024px) 53vw, 1px" unoptimized className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-guild-stone via-guild-stone/30 to-guild-stone/60" />
        <div className="relative flex items-center gap-3 text-guild-gold">
          <Crest className="h-6 w-6" />
          <span className="font-display text-xs uppercase tracking-[0.2em]">D&amp;D</span>
        </div>
        <div className="relative max-w-lg py-8">
          <div className="mb-6 h-px w-16 bg-guild-gold" />
          <h2 className="font-display text-4xl leading-tight xl:text-5xl">Sua próxima jornada começa aqui.</h2>
          <p className="mt-5 max-w-sm font-reading text-lg leading-relaxed text-guild-ink/80">Reúna sua guilda e transforme cada aula em uma aventura.</p>
        </div>
      </aside>
      <section aria-label={title} className="flex min-w-0 items-center justify-center px-4 py-12 sm:px-8 lg:px-12 xl:px-16">
        <div className="page-enter w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <Crest className="h-16 w-16" />
            <h1 className="mt-4 text-2xl">{title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
            <p className="mt-1 font-reading text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
