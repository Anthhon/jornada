import type { Metadata } from "next";
import { PublicAgenda } from "@/features/public-agenda";

export const metadata: Metadata = { title: "Agenda de incursões" };

export default function Page() { return <PublicAgenda embedded />; }
