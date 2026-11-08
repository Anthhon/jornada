"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { isAxiosError } from "axios";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Scroll, SubmitButton } from "@/features/journey/components/ui";
import { requestPasswordReset } from "../services/authentication-service";
import { AuthLayout } from "./auth-layout";

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ defaultValues: { email: "" } });

  async function submit({ email }: { email: string }) {
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (error) {
      setError("root", { message: isAxiosError(error) && error.response?.status === 429
        ? "Muitas tentativas. Aguarde um pouco antes de tentar novamente."
        : "Não foi possível solicitar o link. Verifique sua conexão e tente novamente." });
    }
  }

  return (
    <AuthLayout title="Recuperar senha" subtitle="Debuggers & Developers" description="Vamos ajudar você a voltar à guilda.">
      <Scroll className="p-6 sm:p-8">
        {sent ? (
          <div className="space-y-4 text-center" role="status">
            <MailCheck className="mx-auto h-9 w-9 text-accent-foreground" />
            <h2 className="text-xl">Confira seu e-mail</h2>
            <p className="font-reading leading-relaxed text-muted-foreground">Se houver uma conta ativa com esse e-mail, você receberá um link para criar uma nova senha.</p>
            <p className="text-xs text-muted-foreground">Confira também a caixa de spam. O link é válido por uma hora.</p>
            <Button type="button" variant="outline" className="w-full" onClick={() => setSent(false)}>Usar outro e-mail</Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
            <p className="font-reading text-muted-foreground">Informe o e-mail cadastrado para receber um link de recuperação.</p>
            <Field label="E-mail" error={errors.email?.message}>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="email" autoComplete="email" placeholder="voce@exemplo.com" className="pl-9" aria-invalid={!!errors.email} {...register("email", {
                  required: "Informe seu e-mail.",
                  validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || "Informe um e-mail válido.",
                })} />
              </div>
            </Field>
            {errors.root?.message && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
            <SubmitButton loading={isSubmitting}>Enviar link de recuperação</SubmitButton>
          </form>
        )}
      </Scroll>
      <Button asChild variant="ghost" className="mt-3 w-full"><Link href="/login"><ArrowLeft /> Voltar ao login</Link></Button>
    </AuthLayout>
  );
}
