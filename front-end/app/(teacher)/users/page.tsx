import type { Metadata } from "next";
import { UsersPage } from "@/features/users/components/users-page";

export const metadata: Metadata = { title: "Administração de usuários", robots: { index: false, follow: false } };

export default function Page() { return <UsersPage />; }
