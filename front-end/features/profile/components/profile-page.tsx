"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "@/components/icons/rpg-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, PageHeader, Scroll } from "@/features/journey/components/ui";
import { useJornada } from "@/stores/journey-store";

export function ProfilePage() {
  const session = useJornada((state) => state.session);
  const name = session?.name.trim() || "Professor";
  const username = session?.username || "professor";
  const initial = Array.from(name)[0].toLocaleUpperCase("pt-BR");

  return (
    <div>
      <PageHeader title="Meu perfil" description="Suas informações e seu lugar na guilda." />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <Scroll className="flex min-w-0 flex-col items-center p-6 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-success/40 bg-accent font-display text-3xl font-semibold text-accent-foreground" aria-hidden="true">
            {initial}
          </div>
          <h2 className="mt-5 w-full truncate text-xl" title={name}>{name}</h2>
          <p className="mt-1 w-full truncate text-sm text-muted-foreground" title={`@${username}`}>@{username}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-accent/60 px-3 py-1 text-xs text-accent-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Professor
          </span>
          <p className="mt-6 font-reading text-sm text-muted-foreground">Cada jornada começa com um passo.</p>
        </Scroll>
        <Scroll className="min-w-0 p-6 sm:p-8">
          <h2 className="text-xl">Informações da conta</h2>
          <p className="mt-2 font-reading text-sm text-muted-foreground">Prévia do perfil. A edição dos dados estará disponível em breve.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Nome"><Input value={name} readOnly title={name} className="truncate" /></Field>
            <Field label="Usuário"><Input value={username} readOnly title={username} className="truncate" /></Field>
            <div className="sm:col-span-2">
              <Field label="E-mail de demonstração" hint="Endereço ilustrativo usado somente nesta prévia.">
                <Input value="professor@exemplo.com" type="email" readOnly />
              </Field>
            </div>
          </div>
        </Scroll>
      </div>
      <Button asChild variant="ghost" className="mt-6"><Link href="/dashboard"><ArrowLeft /> Voltar ao salão</Link></Button>
    </div>
  );
}
