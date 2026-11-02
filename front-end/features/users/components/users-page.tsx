"use client";

import { useEffect, useState } from "react";
import { isCancel } from "axios";
import { EmptyState, ErrorState, LoadingState, PageHeader, Scroll } from "@/features/journey/components/ui";
import { getUsers } from "../services/users-service";
import type { User } from "../types/user";

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getUsers(controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setUsers(data);
      setStatus("ready");
    }).catch((error: unknown) => {
      if (!isCancel(error) && !controller.signal.aborted) setStatus("error");
    });
    return () => controller.abort();
  }, [attempt]);

  return (
    <>
      <PageHeader title="Usuários" description="Contas cadastradas na API. O cadastro de aventureiros é separado destas contas." />
      {status === "loading" && <LoadingState />}
      {status === "error" && <ErrorState onRetry={() => { setStatus("loading"); setAttempt((value) => value + 1); }} />}
      {status === "ready" && (users.length ? (
        <Scroll>
          <ul className="divide-y divide-border">
            {users.map((user) => <li key={user.id} className="py-3">
              <p className="font-medium">{[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username}</p>
              <p className="text-sm text-muted-foreground">{user.username}{user.email ? ` · ${user.email}` : ""}</p>
            </li>)}
          </ul>
        </Scroll>
      ) : <EmptyState title="Nenhum usuário" hint="A API retornou uma lista vazia." />)}
    </>
  );
}
