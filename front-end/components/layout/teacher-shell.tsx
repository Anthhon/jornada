"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Confirm, LoadingState } from "@/features/journey/components/ui";
import {
  BookOpen,
  CalendarDays,
  Castle,
  DoorOpen,
  Flame,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Scroll,
  Shield,
  Skull,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { Crest } from "@/features/journey/components/crest";
import { cn } from "@/lib/utils";
import { restoreSession, useJornada } from "@/stores/journey-store";
import { UNAUTHORIZED_EVENT } from "@/lib/api";

const navigation = [
  { href: "/agenda", label: "Agenda de incursões", icon: CalendarDays },
  { href: "/dashboard", label: "Salão da Guilda", icon: Castle },
  { href: "/missions", label: "Missões", icon: Crest },
  { href: "/students", label: "Aventureiros", icon: Users },
  { href: "/users", label: "Usuários da API", icon: Users },
  { href: "/groups", label: "Grupos", icon: Shield },
  { href: "/heroes", label: "Heróis", icon: Flame },
  { href: "/skills", label: "Habilidades", icon: BookOpen },
  { href: "/bosses", label: "Chefes", icon: Skull },
  { href: "/questions", label: "Perguntas", icon: Scroll },
] as const;

function Navigation({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Navegação da área do professor">
      {navigation.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-md border-l-2 border-transparent px-3 text-sm text-sidebar-foreground/80 transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              active && "border-success bg-sidebar-accent font-medium text-sidebar-accent-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
      <Crest />
      {!collapsed && (
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold">Debuggers &amp; Developers</div>
          <div className="text-[0.7rem] uppercase tracking-widest text-muted-foreground">D&amp;D</div>
        </div>
      )}
    </div>
  );
}

function FooterEmblem({ collapsed }: { collapsed?: boolean }) {
  if (collapsed) return <Crest className="mx-auto h-6 w-6 opacity-60" />;

  return (
    <div className="flex items-center gap-2.5 rounded-md border border-sidebar-border bg-card/60 p-3">
      <Crest className="h-6 w-6 shrink-0 opacity-70" />
      <p className="font-reading text-xs italic text-muted-foreground">Cada jornada começa com um passo.</p>
    </div>
  );
}

function ExitButton({ small, onClick }: { small?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
        small && "justify-center px-0",
      )}
      title="Deixar a guilda"
    >
      <DoorOpen className="h-[18px] w-[18px]" strokeWidth={1.6} />
      {!small && "Deixar a guilda"}
    </button>
  );
}

export function TeacherShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useJornada((state) => state.session);
  const setSession = useJornada((state) => state.setSession);
  const ready = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  useEffect(() => {
    restoreSession();
    const expire = () => setSession(null);
    window.addEventListener(UNAUTHORIZED_EVENT, expire);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, expire);
  }, [setSession]);

  useEffect(() => {
    if (ready && session?.role !== "professor") router.replace("/login");
  }, [ready, router, session]);

  if (!ready || session?.role !== "professor") {
    return <LoadingState label="Abrindo os portões…" />;
  }

  const exit = () => {
    setSession(null);
    router.replace("/");
  };

  return (
    <div className="relative z-10 flex min-h-screen">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 transition-[width] duration-200 md:flex",
          collapsed ? "w-[76px]" : "w-60",
        )}
      >
        <Brand collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className={cn("flex h-8 items-center gap-2 rounded-md px-3 text-xs text-muted-foreground hover:bg-sidebar-accent/60", collapsed && "justify-center px-0")}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Recolher</>}
        </button>
        <div className="flex-1 overflow-y-auto"><Navigation collapsed={collapsed} /></div>
        <div className="space-y-3">
          {!collapsed && <div className="px-3 text-xs text-muted-foreground">Mestre: <span className="text-foreground">{session.name}</span></div>}
          <ExitButton small={collapsed} onClick={() => setConfirmExit(true)} />
          <FooterEmblem collapsed={collapsed} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 md:hidden">
          <Brand />
          <Button variant="ghost" size="icon" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu /></Button>
        </header>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="flex w-72 flex-col gap-6 bg-sidebar">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Brand />
            <div className="flex-1"><Navigation onNavigate={() => setMobileOpen(false)} /></div>
            <ExitButton onClick={() => setConfirmExit(true)} />
            <FooterEmblem />
          </SheetContent>
        </Sheet>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-8 md:px-8 md:py-12 xl:px-10 2xl:px-12">{children}</main>
      </div>

      <Confirm
        open={confirmExit}
        onOpenChange={setConfirmExit}
        title="Deixar a guilda?"
        description="Sua sessão será encerrada neste navegador."
        confirmLabel="Deixar a guilda"
        destructive
        onConfirm={exit}
      />
    </div>
  );
}
