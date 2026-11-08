"use client";

import { useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const eventName = "jornada:theme";
const storageKey = "jornada-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event(eventName));
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) applyTheme(event.newValue === "dark" ? "dark" : "light");
  };
  window.addEventListener(eventName, listener);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(eventName, listener); window.removeEventListener("storage", onStorage); };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark" ? "dark" : "light", () => "light");
  useEffect(() => {
    try { applyTheme(localStorage.getItem(storageKey) === "dark" ? "dark" : "light"); }
    catch { /* O tema continua disponível quando o armazenamento estiver bloqueado. */ }
  }, []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Mantém a preferência nesta página. */ }
  }
  return { theme: theme as Theme, toggleTheme };
}
