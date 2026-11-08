import type { Metadata } from "next";
import { ResetPasswordPage } from "@/features/authentication/components/reset-password-page";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function Page() {
  return <ResetPasswordPage />;
}
