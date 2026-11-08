"use client";

import { useEffect, useState } from "react";
import { isCancel } from "axios";
import Link from "next/link";
import { KeyRound } from "@/components/icons/rpg-icons";
import { Button } from "@/components/ui/button";
import { useSidebarAccess } from "@/components/layout/sidebar-access";
import { EmptyState, ErrorState, LoadingState, PageHeader, Scroll } from "@/features/journey/components/ui";
import { getUsers } from "../services/users-service";
import type { User } from "../types/user";

export function UsersPage() {
  const { canViewUsers, loading } = useSidebarAccess();
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!canViewUsers || loading) return;
    const controller = new AbortController();
    getUsers(controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setUsers(data);
      setStatus("ready");
    }).catch((error: unknown) => {
      if (!isCancel(error) && !controller.signal.aborted) setStatus("error");
    });
    return () => controller.abort();
  }, [canViewUsers, loading, attempt]);

  if (loading) return <LoadingState />;
  if (!canViewUsers) return (
    <Scroll className="mx-auto max-w-lg p-8 text-center">
      <KeyRound className="mx-auto mb-4 h-8 w-8 text-accent-foreground" />
      <h1 className="text-xl">Acesso restrito</h1>
      <p className="mt-3 font-reading text-muted-foreground">Esta área está disponível apenas para professores.</p>
      <Button asChild className="mt-6"><Link href="/dashboard">Voltar ao salão</Link></Button>
    </Scroll>
  );

  return (
    <>
      <PageHeader title="Usuários da API" description="Contas de acesso. Área restrita à administração." />
      {status === "loading" && <LoadingState />}
      {status === "error" && <ErrorState onRetry={() => { setStatus("loading"); setAttempt((value) => value + 1); }} />}
      {status === "ready" && (users.length ? (
        <Scroll>
          <ul className="divide-y divide-border">
            {users.map((user) => <li key={user.id} className="min-w-0 py-3">
              <p className="break-words font-medium">{[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username}</p>
              <p className="break-words text-sm text-muted-foreground">{user.username}{user.email ? ` · ${user.email}` : ""}</p>
            </li>)}
          </ul>
        </Scroll>
      ) : <EmptyState title="Nenhum usuário" hint="Nenhuma conta foi encontrada." />)}
    </>
  );
}
