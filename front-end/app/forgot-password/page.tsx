import type { Metadata } from "next";
import { ForgotPasswordPage } from "@/features/authentication/components/forgot-password-page";

export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false, follow: false } };

export default function Page() {
  return <ForgotPasswordPage />;
}
