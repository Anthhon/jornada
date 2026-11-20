import type { Metadata } from "next";
import { ResetPasswordPage } from "@/features/authentication/components/reset-password-page";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function Page({ params }: { params: Promise<{ uid: string; token: string }> }) {
  const { uid, token } = await params;
  return <ResetPasswordPage key={`${uid}-${token}`} uid={uid} token={token} />;
}
