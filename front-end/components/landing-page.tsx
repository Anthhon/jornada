"use client";

import {
  ArrowDown,
  CalendarDays,
  Castle,
  Menu,
  Search,
  Shield,
  Skull,
  Swords,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { groups, missions } from "@/mocks/landing-agenda";

const groupTones = [
  "bg-accent/60",
  "bg-blue-100/60",
  "bg-amber-50/70",
  "bg-secondary/60",
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <header className="guild-public-header relative z-30">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-5 py-4 md:px-8 xl:px-10 2xl:px-12">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-guild-green"
            aria-label="Abrir menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <Link
            href="/login"
            aria-label="Área do professor"
            title="Área do professor"
            className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors hover:bg-guild-green"
          >
            Área do professor
          </Link>
        </div>
      </header>

      <div className={`guild-menu fixed inset-0 z-50 ${open ? "is-open" : ""}`} role="dialog" aria-modal="true" aria-label="Menu público" inert={!open}>
        <button
          type="button"
          className="guild-menu-backdrop absolute inset-0 bg-black/60"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
        <aside className="guild-menu-panel absolute inset-y-0 left-0 flex w-72 max-w-full flex-col border-r border-guild-gold bg-guild-stone p-6 text-guild-ink shadow-2xl">
          <div className="flex min-h-10 items-center justify-between gap-2">
            <span className="min-w-0 font-display text-sm leading-tight tracking-wide text-guild-gold">Debuggers &amp; Developers</span>
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-guild-ink transition-colors hover:text-guild-gold"
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="mt-6 flex flex-col gap-2" aria-label="Menu público">
            <Link href="/" className="flex h-11 items-center gap-3 rounded-md px-3 hover:bg-guild-green" onClick={() => setOpen(false)}>
              <Castle className="h-4 w-4" /> Início
            </Link>
            <Link href="/login" className="flex h-11 items-center gap-3 rounded-md px-3 hover:bg-guild-green" onClick={() => setOpen(false)}>
              <Swords className="h-4 w-4" /> Área do professor
            </Link>
            <a href="#agenda" className="flex h-11 items-center gap-3 rounded-md px-3 hover:bg-guild-green" onClick={() => setOpen(false)}>
              <CalendarDays className="h-4 w-4" /> Agenda de incursões
            </a>
            <a href="#herois" className="flex h-11 items-center gap-3 rounded-md px-3 hover:bg-guild-green" onClick={() => setOpen(false)}>
              <Shield className="h-4 w-4" /> Heróis
            </a>
            <a href="#bosses" className="flex h-11 items-center gap-3 rounded-md px-3 hover:bg-guild-green" onClick={() => setOpen(false)}>
              <Skull className="h-4 w-4" /> Bosses
            </a>
          </nav>
          <p className="mt-auto border-t border-guild-gold/30 pt-5 font-reading text-sm text-guild-gold">
            Cada jornada começa com um passo.
          </p>
        </aside>
      </div>
    </>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function PublicAgenda() {
  const [query, setQuery] = useState("");
  const filteredGroups = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("pt-BR");
    if (!search) return groups;

    return groups
      .map((group) => ({
        ...group,
        members: group.name.toLocaleLowerCase("pt-BR").includes(search)
          ? group.members
          : group.members.filter((member) =>
            `${member.name} ${member.registration}`
              .toLocaleLowerCase("pt-BR")
              .includes(search),
          ),
      }))
      .filter((group) => group.members.length > 0);
  }, [query]);

  return (
    <section id="agenda" className="mx-auto w-full max-w-[1600px] px-5 py-10 md:px-8 md:py-12 xl:px-10 2xl:px-12">
      <div className="mb-8">
        <h2 className="text-[1.85rem] leading-tight text-foreground">Agenda de incursões</h2>
        <p className="mt-1.5 max-w-xl font-reading text-muted-foreground">
          Aventureiros, grupos e datas de cada missão.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <label className="relative w-full max-w-sm">
          <span className="sr-only">Buscar na agenda</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            className="flex h-11 w-full rounded-md border border-input bg-secondary/50 py-1 pl-9 pr-3 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            placeholder="Nome, matrícula ou grupo"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" /> {missions.length} missões · {groups.length} grupos
        </span>
      </div>

      <div className="overflow-x-auto rounded-sm border border-border-strong" role="region" aria-label="Calendário de incursões por grupo" tabIndex={0}>
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">
            Matrículas, aventureiros, grupos, linguagens e datas de participação nas incursões
          </caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-r px-4 py-3 text-left font-medium">Matrícula</th>
              <th scope="col" className="min-w-52 border-b border-r px-4 py-3 text-left font-medium">Aventureiro</th>
              <th scope="col" className="border-b border-r px-4 py-3 text-left font-medium">Grupo</th>
              {missions.map((mission) => (
                <th key={mission.id} scope="col" className="min-w-36 border-b border-r px-4 py-3 text-center font-medium">
                  <span className="block">Incursão {mission.number}</span>
                  <span className="mt-1 block max-w-48 font-reading text-xs font-normal text-muted-foreground">
                    {mission.title}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map((group, groupIndex) =>
              group.members.map((member, memberIndex) => (
                <tr key={member.id} className={groupTones[groupIndex % groupTones.length]}>
                  <td className="border-b border-r px-4 py-3 font-mono text-xs">{member.registration}</td>
                  <td className="border-b border-r px-4 py-3">{member.name}</td>
                  {memberIndex === 0 && (
                    <th scope="rowgroup" rowSpan={group.members.length} className="min-w-40 border-b border-r px-4 py-4 text-center font-display font-semibold">
                      {group.name}
                    </th>
                  )}
                  {memberIndex === 0 &&
                    group.schedule.map((slot, column) => (
                      <td key={missions[column].id} rowSpan={group.members.length} className="border-b border-r px-4 py-4 text-center">
                        {slot ? (
                          <>
                            <span className="block font-medium">{slot.language}</span>
                            <time dateTime={slot.date} className="mt-1 block whitespace-nowrap font-reading text-muted-foreground">
                              {formatDate(slot.date)}
                            </time>
                          </>
                        ) : (
                          <span className="text-muted-foreground" aria-label="Sem participação">—</span>
                        )}
                      </td>
                    ))}
                </tr>
              )),
            )}
            {filteredGroups.length === 0 && (
              <tr>
                <td colSpan={3 + missions.length} className="px-5 py-10 text-center font-reading text-muted-foreground">
                  Nenhum aventureiro ou grupo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function LandingPage() {
  const scrollToAgenda = () => {
    document.getElementById("agenda")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  return (
    <div className="relative z-10 min-h-screen">
      <PublicHeader />
      <main>
        <section className="guild-hero" aria-labelledby="guild-title">
          <Image
            src="/guild-hall.jpg"
            alt="Salão medieval de pedra com estandartes verdes e tochas acesas"
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover"
          />
          <div className="guild-hero-content relative z-10 mx-auto flex max-w-3xl flex-col items-center px-5 text-center">
            <div className="mb-5 flex items-center gap-4 text-guild-gold">
              <span className="h-px w-12 bg-guild-gold/60" />
              <Swords className="h-7 w-7" />
              <span className="h-px w-12 bg-guild-gold/60" />
            </div>
            <p className="mb-4 font-display text-xs uppercase tracking-[0.24em] text-guild-gold">
              A guilda dos novos aventureiros
            </p>
            <h1 id="guild-title" className="guild-title text-4xl leading-tight sm:text-6xl">
              Debuggers <span className="block text-guild-gold">&amp;</span> Developers
            </h1>
            <p className="mt-6 max-w-lg font-reading text-base leading-relaxed text-guild-ink sm:text-lg">
              Onde o código encontra a aventura.
              <br />
              Reúna seu grupo, explore linguagens e conquiste cada missão.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="guild-cta inline-flex h-12 items-center justify-center gap-2 px-6 text-sm font-medium transition-colors"
                onClick={scrollToAgenda}
              >
                <CalendarDays className="h-4 w-4" /> Consultar incursões <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
        <section id="herois" className="mx-auto w-full max-w-[1600px] px-5 py-10 md:px-8 md:py-12 xl:px-10 2xl:px-12">
          <h2 className="text-[1.85rem] leading-tight text-foreground">Heróis</h2>
        </section>
        <section id="bosses" className="mx-auto w-full max-w-[1600px] px-5 py-10 md:px-8 md:py-12 xl:px-10 2xl:px-12">
          <h2 className="text-[1.85rem] leading-tight text-foreground">Bosses</h2>
        </section>
        <div className="guild-agenda-band">
          <PublicAgenda />
        </div>
      </main>
      <footer className="guild-public-header border-t border-guild-gold/30 px-5 py-7 text-center">
        <p className="font-display text-sm">Debuggers &amp; Developers</p>
        <p className="mt-2 font-reading text-xs text-guild-gold">Cada jornada começa com um passo.</p>
      </footer>
    </div>
  );
}
