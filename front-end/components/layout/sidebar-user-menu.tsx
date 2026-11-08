"use client";

import Link from "next/link";
import { ChevronsUpDown, LogOut, Moon, Sun, UserRound } from "@/components/icons/rpg-icons";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { Theme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function ProfileFooter({ name, role, collapsed, theme, onTheme, onExit, onNavigate }: {
  name: string; role: string; collapsed?: boolean; theme: Theme;
  onTheme: () => void; onExit: () => void; onNavigate?: () => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]).join("").toLocaleUpperCase("pt-BR") || "?";
  const itemStyle = "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring";

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }
  function items() { return Array.from(menu.current?.querySelectorAll<HTMLElement>("[role^='menuitem']") ?? []); }
  function show(last = false) {
    setOpen(true);
    requestAnimationFrame(() => { const entries = items(); entries[last ? entries.length - 1 : 0]?.focus(); });
  }

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); };
  }, [open]);

  function menuKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key === "Tab") { close(true); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const entries = items();
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + entries.length) % entries.length;
    entries[next]?.focus();
  }

  return (
    <div ref={root} className="relative mt-auto shrink-0 border-t border-sidebar-border pt-3">
      {open && (
        <div ref={menu} id={id} role="menu" aria-label="Minha conta" onKeyDown={menuKey}
          className="absolute bottom-[calc(100%+0.5rem)] left-0 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-sidebar-border bg-sidebar p-1.5 shadow-xl">
          <Link href="/me" role="menuitem" tabIndex={-1} className={itemStyle} onClick={() => { close(); onNavigate?.(); }}>
            <UserRound className="h-[18px] w-[18px]" /> Perfil
          </Link>
          <button type="button" role="menuitemcheckbox" aria-checked={theme === "dark"} tabIndex={-1} onClick={onTheme} className={itemStyle}>
            {theme === "dark" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
            Tema <span className="ml-auto text-xs">{theme === "dark" ? "Escuro" : "Claro"}</span>
          </button>
          <div role="separator" className="my-1 border-t border-sidebar-border" />
          <button type="button" role="menuitem" tabIndex={-1} onClick={() => { close(); onExit(); }} className={cn(itemStyle, "text-destructive hover:bg-destructive/10")}>
            <LogOut className="h-[18px] w-[18px]" /> Sair
          </button>
        </div>
      )}
      <button
        ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={`${name}, ${role}. Abrir menu da conta`} title={collapsed ? `${name} — ${role}` : undefined}
        onClick={() => open ? close() : show()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); show(event.key === "ArrowUp"); }
          if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(true); }
        }}
        className={cn(
          "flex min-h-14 w-full min-w-0 items-center gap-2.5 rounded-lg border border-sidebar-border bg-card p-2 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
          open && "bg-sidebar-accent", collapsed && "justify-center px-0",
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sidebar-accent-foreground/40 bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground" aria-hidden="true">{initials}</span>
        {!collapsed && <>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium" title={name}>{name}</span><span className="block truncate text-xs text-muted-foreground">{role}</span></span>
          <ChevronsUpDown className="h-4 w-4 shrink-0" />
        </>}
      </button>
    </div>
  );
}
