"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { sidebarSections, type SidebarCounts } from "./sidebar-config";

function ItemLink({ href, label, active, collapsed, count, onNavigate, children }: {
  href: string; label: string; active: boolean; collapsed: boolean; count?: number;
  onNavigate?: () => void; children: ReactNode;
}) {
  const id = useId();
  const anchor = useRef<HTMLAnchorElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltip, setTooltip] = useState<{ left: number; top: number } | null>(null);
  const validCount = typeof count === "number" && Number.isFinite(count) && count >= 0 ? Math.floor(count) : undefined;
  const fullLabel = `${label}${validCount !== undefined ? ` (${validCount})` : ""}`;

  function cancelHide() { if (hideTimer.current) clearTimeout(hideTimer.current); }
  function hide() { cancelHide(); setTooltip(null); }
  function show() {
    if (!collapsed || !anchor.current) return;
    cancelHide();
    const rect = anchor.current.getBoundingClientRect();
    setTooltip({ left: rect.right + 10, top: Math.min(window.innerHeight - 28, Math.max(28, rect.top + rect.height / 2)) });
  }
  function hideSoon() { cancelHide(); hideTimer.current = setTimeout(() => setTooltip(null), 150); }

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);
  useEffect(() => {
    if (!tooltip) return;
    const close = () => setTooltip(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [tooltip]);

  return (
    <>
      <Link
        ref={anchor} href={href} onClick={() => { hide(); onNavigate?.(); }}
        onMouseEnter={show} onMouseLeave={hideSoon} onFocus={show} onBlur={hide}
        onKeyDown={(event) => { if (event.key === "Escape") hide(); }}
        aria-current={active ? "page" : undefined}
        aria-describedby={collapsed && tooltip ? id : undefined}
        aria-label={collapsed ? fullLabel : undefined}
        className={cn(
          "flex min-h-11 min-w-0 items-center gap-2.5 rounded-md border-l-[3px] border-transparent px-3 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
          active && "border-sidebar-accent-foreground bg-sidebar-accent font-medium text-sidebar-accent-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        {children}
        <span className={cn("min-w-0 flex-1", collapsed && "sr-only")}>{label}</span>
        {!collapsed && validCount !== undefined && (
          <span className="shrink-0 rounded-md bg-sidebar-primary px-1.5 py-0.5 text-[0.7rem] font-semibold tabular-nums text-sidebar-primary-foreground" aria-label={`${validCount}`}>
            {validCount > 99 ? "99+" : validCount}
          </span>
        )}
      </Link>
      {collapsed && tooltip && createPortal(
        <span id={id} role="tooltip" onMouseEnter={cancelHide} onMouseLeave={hideSoon}
          className="fixed z-[100] max-w-64 -translate-y-1/2 rounded-md bg-sidebar-foreground px-3 py-2 text-xs text-sidebar shadow-lg"
          style={tooltip}>{fullLabel}</span>, document.body,
      )}
    </>
  );
}

export function Navigation({ collapsed = false, counts = {}, isAdmin = false, onNavigate }: {
  collapsed?: boolean; counts?: SidebarCounts; isAdmin?: boolean; onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const id = useId();
  const sections = sidebarSections.map((section) => ({ ...section, items: section.items.filter((item) => !item.adminOnly || isAdmin) })).filter((section) => section.items.length);

  return (
    <nav aria-label="Principal">
      <ul className="space-y-4">
        {sections.map((section, index) => (
          <li key={section.id} className={cn(collapsed && index > 0 && "border-t border-sidebar-border pt-3")}>
            <p id={`${id}-${section.id}`} className={cn("mb-2 px-3 font-pixel text-[11px] font-semibold uppercase leading-4 tracking-widest text-sidebar-foreground/75", collapsed && "sr-only")}>
              {section.label}
            </p>
            <ul aria-labelledby={`${id}-${section.id}`} className="space-y-1">
              {section.items.map(({ href, label, icon: Icon, countKey }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <ItemLink href={href} label={label} active={active} collapsed={collapsed} count={countKey ? counts[countKey] : undefined} onNavigate={onNavigate}>
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-sidebar-accent-foreground")} />
                    </ItemLink>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
