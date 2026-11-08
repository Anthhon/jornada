import { GroupsPage } from "@/features/groups";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Grupos" };

export default function Page() {
  return <GroupsPage />;
}
