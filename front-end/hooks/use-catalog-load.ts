"use client";
import { useEffect, useState } from "react";
import { loadCatalog } from "@/lib/catalog-cache";

export function useCatalogLoad() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadCatalog().then(() => { if (active) setStatus("ready"); }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [attempt]);
  return { status, retry: () => { setStatus("loading"); setAttempt((value) => value + 1); } };
}
