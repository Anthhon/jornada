"use client";
import { useEffect, useState } from "react";
export function useSimulatedLoad(delay = 350) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setStatus("ready"), delay);
    return () => clearTimeout(t);
  }, [n, delay]);
  return {
    status,
    retry: () => {
      setStatus("loading");
      setN((x) => x + 1);
    },
  };
}
