"use client";

import {
  CalendarDays,
  Castle,
  Menu,
  Search,
  Shield,
  Skull,
  X,
} from "@/components/icons/rpg-icons";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { groups, missions } from "@/mocks/landing-agenda";
import { heroes, bosses } from "@/mocks/landing-personagens";
import { Crest } from "@/features/journey/components/crest";

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
          <div className="flex min-h-10 items-center gap-2 pl-3">
            <span className="min-w-0 flex-1 font-display text-sm leading-tight tracking-wide text-guild-gold">Debuggers &amp; Developers</span>
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
              <Crest className="h-4 w-4" /> Área do professor
            </Link>
            <Link href="/agenda" className="flex h-11 items-center gap-3 rounded-md px-3 hover:bg-guild-green" onClick={() => setOpen(false)}>
              <CalendarDays className="h-4 w-4" /> Agenda de incursões
            </Link>
            <Link href="/#jornada" className="flex h-11 items-center gap-3 rounded-md px-3 hover:bg-guild-green" onClick={() => setOpen(false)}>
              <Castle className="h-4 w-4" /> A Jornada pelo Tesouro
            </Link>
            <Link href="/#herois" className="flex h-11 items-center gap-3 rounded-md px-3 hover:bg-guild-green" onClick={() => setOpen(false)}>
              <Shield className="h-4 w-4" /> Heróis
            </Link>
            <Link href="/#bosses" className="flex h-11 items-center gap-3 rounded-md px-3 hover:bg-guild-green" onClick={() => setOpen(false)}>
              <Skull className="h-4 w-4" /> Bosses
            </Link>
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

export function PublicAgenda() {
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

type Character = {
  name: string;
  image: string;
  intro: string;
  summary?: string;
  items: { name: string; description: string }[];
};

function CharacterGrid({ characters, detailLabel, kind }: { characters: Character[]; detailLabel: string; kind: "hero" | "boss" }) {
  const isBoss = kind === "boss";

  return (
    <div className="mt-7 flex flex-wrap items-start justify-center gap-5 md:gap-6">
      {characters.map((character) => (
        <article
          key={character.name}
          className="group flex w-full flex-col overflow-hidden rounded-md border border-guild-gold/45 bg-card text-card-foreground shadow-[0_12px_32px_-24px_rgba(0,0,0,0.8)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-guild-gold hover:shadow-[0_18px_38px_-24px_rgba(0,0,0,0.9)] motion-reduce:transform-none motion-reduce:transition-none sm:w-[calc((100%_-_1.25rem)/2)] lg:w-[calc((100%_-_3rem)/3)]"
        >
          <div className="relative aspect-square w-full overflow-hidden border-b border-guild-gold/40 bg-guild-stone">
            <Image
              src={character.image}
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="scale-110 object-cover object-center blur-md brightness-50"
            />
            <Image
              src={character.image}
              alt={`Ilustração de ${character.name}`}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-contain object-center"
            />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 to-transparent" />
            <span aria-hidden="true" className={`absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-guild-gold/70 bg-guild-stone/90 text-guild-gold shadow-lg ${isBoss ? "rotate-3" : "-rotate-3"}`}>
              {isBoss ? <Skull className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
            <div className="min-h-28 sm:min-h-32">
              <h3 className="text-xl leading-tight text-foreground">{character.name}</h3>
              {isBoss ? (
                <>
                  <p className="mt-3 inline-block rounded-sm border border-guild-gold/60 bg-guild-stone px-3 py-1 font-display text-sm font-semibold text-guild-ink">{character.intro.split(". ")[0].replace(/\.$/, "")}</p>
                  <p className="mt-2 font-reading leading-relaxed text-muted-foreground">{character.summary}</p>
                  {character.intro.includes(". ") && <p className="mt-2 font-reading text-sm leading-relaxed text-muted-foreground">{character.intro.slice(character.intro.indexOf(". ") + 2)}</p>}
                </>
              ) : <p className="mt-2 font-reading leading-relaxed text-muted-foreground">{character.intro}</p>}
            </div>
            <details className="mt-auto border-t border-border-strong pt-4 open:mt-5">
              <summary className="cursor-pointer rounded-sm py-2 font-display text-sm font-semibold tracking-wide text-foreground marker:text-guild-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Ver {detailLabel}
              </summary>
              <div tabIndex={0} role="region" aria-label={`${detailLabel} de ${character.name}`} className="mt-3 h-64 overflow-y-auto rounded-sm border-l-2 border-guild-gold/35 pl-4 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-72">
                <ul className="space-y-4 font-reading text-sm leading-relaxed text-foreground">
                  {character.items.map((item) => (
                    <li key={item.name}><strong>{item.name}:</strong> {item.description}</li>
                  ))}
                </ul>
              </div>
            </details>
          </div>
        </article>
      ))}
    </div>
  );
}

export function LandingPage() {
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
              <Crest className="h-7 w-7" />
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
              <Link href="/agenda" className="guild-cta inline-flex h-12 items-center justify-center gap-2 px-6 text-sm font-medium transition-colors">
                <CalendarDays className="h-4 w-4" /> Consultar incursões
              </Link>
            </div>
          </div>
        </section>
        <section id="jornada" aria-labelledby="jornada-title" className="border-b border-guild-gold/30 bg-secondary/35">
          <div className="mx-auto w-full max-w-[1600px] px-5 py-12 md:px-8 md:py-16 xl:px-10 2xl:px-12">
            <div className="flex items-center gap-4">
              <span aria-hidden="true" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-guild-gold/60 bg-guild-stone text-guild-gold shadow-md"><Castle className="h-5 w-5" /></span>
              <h2 id="jornada-title" className="text-[1.85rem] leading-tight text-foreground">A Jornada pelo Tesouro</h2>
              <span aria-hidden="true" className="hidden h-px flex-1 bg-gradient-to-r from-guild-gold/70 to-transparent sm:block" />
            </div>
            <div className="mt-7 overflow-hidden rounded-lg border border-guild-gold/55 bg-guild-stone p-3 shadow-[0_20px_50px_-36px_rgba(0,0,0,0.95)] sm:p-5">
              <div className="space-y-4 rounded-md border border-guild-gold/25 bg-parchment p-5 font-reading leading-relaxed text-parchment-foreground sm:p-7 lg:columns-3 lg:gap-8 lg:space-y-0 [&>p]:mb-4 [&>p]:break-inside-avoid lg:[&>p]:mb-0">
                <p>Em cada incursão, equipes exploram uma masmorra ancestral em busca do Baú do Tesouro e do Pergaminho do Destino, capaz de conceder pontos extras nas notas finais. Para chegar lá, enfrentam os testes dos magos sobre Paradigmas de Computação.</p>
                <p>Três equipes formam uma Aliança e percorrem quatro níveis. Em cada um dos três primeiros, uma equipe apresenta sua linguagem; sua pontuação contribui para o Dano Base da Aliança. Em seguida, responde a cinco perguntas: cada acerto concede 1 Ponto de Recurso (PR).</p>
                <p>No quarto nível, o Covil do Monólito, o Dano Base acumulado atinge o chefão. O boss pode aplicar penalidades por tempo de apresentação excedido ou perguntas erradas; as classes gastam os PR acumulados para ativar habilidades, enfrentar penalidades, proteger aliados ou aumentar o dano.</p>
              </div>
              <figure className="relative isolate mt-3 overflow-hidden rounded-md border border-guild-gold/45 bg-guild-stone sm:mt-5">
                <Image src="/jornada-horizontal.png" alt="Ilustração de uma masmorra em meio à floresta, com salas de pedra e um baú em uma câmara circular" fill sizes="100vw" className="-z-10 object-cover" />
                <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/25 to-black/5" />
                <figcaption className="flex min-h-[46rem] items-end p-4 sm:min-h-[36rem] sm:p-6 lg:aspect-[16/7] lg:min-h-0 lg:p-8">
                  <ol aria-label="Etapas da jornada" className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <li className="rounded-sm border border-guild-gold/55 bg-black/80 p-4 text-white shadow-lg backdrop-blur-[2px]"><span aria-hidden="true" className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-guild-gold/70 bg-guild-green font-display text-xs text-guild-ink">1</span><strong className="block font-display text-guild-gold">1º nível</strong><span className="mt-2 block font-reading text-sm leading-relaxed">Primeira equipe: apresentação e cinco perguntas.</span></li>
                    <li className="rounded-sm border border-guild-gold/55 bg-black/80 p-4 text-white shadow-lg backdrop-blur-[2px]"><span aria-hidden="true" className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-guild-gold/70 bg-guild-green font-display text-xs text-guild-ink">2</span><strong className="block font-display text-guild-gold">2º nível</strong><span className="mt-2 block font-reading text-sm leading-relaxed">Segunda equipe: apresentação e cinco perguntas.</span></li>
                    <li className="rounded-sm border border-guild-gold/55 bg-black/80 p-4 text-white shadow-lg backdrop-blur-[2px]"><span aria-hidden="true" className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-guild-gold/70 bg-guild-green font-display text-xs text-guild-ink">3</span><strong className="block font-display text-guild-gold">3º nível</strong><span className="mt-2 block font-reading text-sm leading-relaxed">Terceira equipe: apresentação e cinco perguntas.</span></li>
                    <li className="rounded-sm border border-guild-gold/70 bg-guild-green/95 p-4 text-guild-ink shadow-lg backdrop-blur-[2px]"><span aria-hidden="true" className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-guild-gold bg-guild-stone font-display text-xs text-guild-gold">4</span><strong className="block font-display text-guild-gold">Final e tesouro</strong><span className="mt-2 block font-reading text-sm leading-relaxed">Confronto com o boss; os resultados das incursões podem render pontos extras.</span></li>
                  </ol>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>
        <section id="herois" aria-labelledby="herois-title" className="border-b border-guild-gold/25 bg-accent/20">
          <div className="mx-auto w-full max-w-[1600px] px-5 py-12 md:px-8 md:py-16 xl:px-10 2xl:px-12">
            <div className="flex items-center gap-4">
              <span aria-hidden="true" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-guild-gold/60 bg-guild-green text-guild-ink shadow-md"><Shield className="h-5 w-5" /></span>
              <h2 id="herois-title" className="text-[1.85rem] leading-tight text-foreground">Heróis</h2>
              <span aria-hidden="true" className="hidden h-px flex-1 bg-gradient-to-r from-guild-gold/70 to-transparent sm:block" />
            </div>
            <CharacterGrid characters={heroes} detailLabel="habilidades" kind="hero" />
          </div>
        </section>
        <section id="bosses" aria-labelledby="bosses-title" className="border-b border-guild-gold/45 bg-guild-stone text-guild-ink">
          <div className="mx-auto w-full max-w-[1600px] px-5 py-12 md:px-8 md:py-16 xl:px-10 2xl:px-12">
            <div className="flex items-center gap-4">
              <span aria-hidden="true" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-guild-gold/60 bg-black/25 text-guild-gold shadow-md"><Skull className="h-5 w-5" /></span>
              <div>
                <h2 id="bosses-title" className="text-[1.85rem] leading-tight text-guild-ink">Bosses</h2>
                <p className="mt-2 max-w-4xl font-reading leading-relaxed text-guild-gold">O chefe é sorteado após as provações dos magos e antes da escolha dos heróis.</p>
              </div>
              <span aria-hidden="true" className="hidden h-px flex-1 bg-gradient-to-r from-guild-gold/70 to-transparent sm:block" />
            </div>
            <CharacterGrid characters={bosses} detailLabel="penalidades" kind="boss" />
          </div>
        </section>
      </main>
      <footer className="guild-public-header border-t border-guild-gold/30 px-5 py-7 text-center">
        <p className="font-display text-sm">Debuggers &amp; Developers</p>
        <p className="mt-2 font-reading text-xs text-guild-gold">Cada jornada começa com um passo.</p>
      </footer>
    </div>
  );
}
