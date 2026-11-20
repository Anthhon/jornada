"use client";
import { useEffect, useState } from "react";
import { getAgenda } from "../services/agenda-service";
import type { PublicAgenda } from "../types/agenda";

export function useAgenda() {
  const [agenda, setAgenda] = useState<PublicAgenda | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => { getAgenda().then((data) => { if (active) { setAgenda(data); setStatus("ready"); } }).catch(() => { if (active) setStatus("error"); }); };
    refresh();
    window.addEventListener("focus", refresh); window.addEventListener("storage", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); window.removeEventListener("storage", refresh); };
  }, [attempt]);
  return { agenda, status, retry: () => { setStatus("loading"); setAttempt((value) => value + 1); } };
}
