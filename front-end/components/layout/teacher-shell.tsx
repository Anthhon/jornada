"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Confirm, LoadingState } from "@/features/journey/components/ui";
import { Crest } from "@/features/journey/components/crest";
import { getCurrentUser } from "@/features/authentication/services/authentication-service";
import type { CurrentUser } from "@/features/authentication/schemas/current-user";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { restoreSession, useJornada } from "@/stores/journey-store";
import { UNAUTHORIZED_EVENT } from "@/lib/api";
import { Menu, PanelLeftClose, PanelLeftOpen } from "@/components/icons/rpg-icons";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Navigation } from "./sidebar-navigation";
import { ProfileFooter } from "./sidebar-user-menu";
import type { SidebarCounts } from "./sidebar-config";
import { SidebarAccessContext } from "./sidebar-access";

export type { SidebarCounts } from "./sidebar-config";

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5 px-1", collapsed && "justify-center px-0")}>
      <Crest className="h-9 w-9 shrink-0" />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="font-display text-sm font-semibold">Debuggers &amp; Developers</div>
          <div className="mt-1 text-[0.7rem] uppercase tracking-widest text-sidebar-foreground/75">D&amp;D</div>
        </div>
      )}
    </div>
  );
}

export function TeacherShell({ children, counts }: {
  children: ReactNode;
  /** Omita para usar os dados locais; passe {} para ocultar os contadores. */
  counts?: SidebarCounts;
}) {
  const router = useRouter();
  const session = useJornada((state) => state.session);
  const setSession = useJornada((state) => state.setSession);
  const incursions = useJornada((state) => state.incursions);
  const sessionUsername = session?.username;
  const ready = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const collapseButton = useRef<HTMLButtonElement>(null);
  const [identity, setIdentity] = useState<{ sessionUsername: string; profile: CurrentUser | null } | null>(null);
  const { theme, toggleTheme } = useTheme();
  const profile = identity?.sessionUsername === sessionUsername ? identity?.profile : null;
  const access = useMemo(() => ({
    canViewUsers: profile?.role === "teacher",
    loading: !!sessionUsername && identity?.sessionUsername !== sessionUsername,
  }), [profile, sessionUsername, identity]);

  useEffect(() => {
    restoreSession();
    const expire = () => setSession(null);
    window.addEventListener(UNAUTHORIZED_EVENT, expire);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, expire);
  }, [setSession]);

  useEffect(() => {
    if (ready && session?.role !== "professor") router.replace("/login");
  }, [ready, router, session]);

  useEffect(() => {
    if (!sessionUsername) return;
    const controller = new AbortController();
    getCurrentUser(controller.signal).then((result) => {
      if (!controller.signal.aborted) setIdentity({ sessionUsername, profile: result });
    }).catch(() => {
      if (!controller.signal.aborted) setIdentity({ sessionUsername, profile: null });
    });
    return () => controller.abort();
  }, [sessionUsername]);

  useEffect(() => {
    if (!sessionUsername) return;
    const toggle = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || !event.ctrlKey || event.altKey || event.shiftKey || event.key.toLowerCase() !== "b") return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;
      event.preventDefault();
      if (window.matchMedia("(min-width: 768px)").matches) {
        setCollapsed((value) => !value);
        requestAnimationFrame(() => collapseButton.current?.focus());
      }
      else setMobileOpen((value) => !value);
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, [sessionUsername]);

  if (!ready || session?.role !== "professor") return <LoadingState fullScreen label="Abrindo os portões…" />;

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || session.name.trim() || session.username;
  const displayRole = profile?.role === "student" ? "Aluno" : "Professor";
  const resolvedCounts = counts ?? {
    missions: incursions.length,
    agenda: incursions.filter((incursion) => incursion.status !== "concluida").length,
  };
  const exit = () => { setSession(null); router.replace("/"); };

  return (
    <SidebarAccessContext.Provider value={access}>
      <div className="relative z-10 flex min-h-svh">
        <aside className={cn(
          "sticky top-0 z-30 hidden h-svh shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar p-3 transition-[width] duration-200 motion-reduce:transition-none md:flex",
          collapsed ? "w-20" : "w-64",
        )}>
          <Brand collapsed={collapsed} />
          <button
            ref={collapseButton} type="button" onClick={() => setCollapsed((value) => !value)}
            className={cn(
              "flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-sidebar-accent-foreground/40 bg-sidebar-primary px-3 text-xs font-medium text-sidebar-primary-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"} aria-expanded={!collapsed}
            aria-controls="teacher-sidebar-navigation" aria-keyshortcuts="Control+B"
            title={collapsed ? "Expandir menu (Ctrl+B)" : "Recolher menu (Ctrl+B)"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Recolher <kbd aria-hidden="true" className="ml-auto rounded border border-current/30 px-1 py-0.5 text-[0.65rem]">Ctrl B</kbd></>}
          </button>
          <div id="teacher-sidebar-navigation" className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 py-1">
            <Navigation collapsed={collapsed} counts={resolvedCounts} isAdmin={access.canViewUsers} />
          </div>
          <ProfileFooter key={collapsed ? "collapsed" : "expanded"} name={displayName} role={displayRole} collapsed={collapsed} theme={theme} onTheme={toggleTheme} onExit={() => setConfirmExit(true)} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 md:hidden">
            <Brand />
            <Button variant="ghost" size="icon" aria-label="Abrir menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu /></Button>
          </header>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="flex w-72 flex-col gap-4 bg-sidebar p-4">
              <SheetTitle className="sr-only">Menu principal</SheetTitle>
              <div className="pr-7"><Brand /></div>
              <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 py-1">
                <Navigation counts={resolvedCounts} isAdmin={access.canViewUsers} onNavigate={() => setMobileOpen(false)} />
              </div>
              <ProfileFooter name={displayName} role={displayRole} theme={theme} onTheme={toggleTheme} onNavigate={() => setMobileOpen(false)} onExit={() => { setMobileOpen(false); setConfirmExit(true); }} />
            </SheetContent>
          </Sheet>
          <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-5 py-8 md:px-8 md:py-12 xl:px-10 2xl:px-12">{children}</main>
        </div>

        <Confirm open={confirmExit} onOpenChange={setConfirmExit} title="Deixar a guilda?" description="Sua sessão será encerrada neste navegador." confirmLabel="Deixar a guilda" destructive onConfirm={exit} />
      </div>
    </SidebarAccessContext.Provider>
  );
}
