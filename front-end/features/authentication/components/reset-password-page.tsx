"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { isAxiosError } from "axios";
import { ArrowLeft, KeyRound, ShieldCheck } from "@/components/icons/rpg-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Scroll, SubmitButton } from "@/features/journey/components/ui";
import { confirmPasswordReset } from "../services/authentication-service";
import { AuthLayout } from "./auth-layout";

type Values = { password: string; confirmPassword: string };

export function ResetPasswordPage({ uid, token }: { uid?: string; token?: string }) {
  const [saved, setSaved] = useState(false);
  const [invalidLink, setInvalidLink] = useState(!uid || !token);
  const { register, handleSubmit, getValues, setError, formState: { errors, isSubmitting } } = useForm<Values>({ defaultValues: { password: "", confirmPassword: "" } });

  async function submit({ password }: Values) {
    if (!uid || !token) return;
    try {
      await confirmPasswordReset(uid, token, password);
      setSaved(true);
    } catch (error) {
      if (isAxiosError(error)) {
        const data = error.response?.data;
        if (data?.code === "invalid_token") { setInvalidLink(true); return; }
        if (Array.isArray(data?.new_password)) {
          setError("password", { message: data.new_password.join(" ") });
          return;
        }
      }
      setError("root", { message: isAxiosError(error) && error.response?.status === 429
        ? "Muitas tentativas. Aguarde um pouco antes de tentar novamente."
        : "Não foi possível salvar sua senha. Verifique sua conexão e tente novamente." });
    }
  }

  return (
    <AuthLayout title="Nova senha" subtitle="Debuggers & Developers" description="Um novo acesso para continuar sua jornada.">
      <Scroll className="p-6 sm:p-8">
        {saved ? (
          <div className="space-y-4 text-center" role="status">
            <ShieldCheck className="mx-auto h-9 w-9 text-accent-foreground" />
            <h2 className="text-xl">Senha atualizada</h2>
            <p className="font-reading text-muted-foreground">Tudo pronto! Use sua nova senha para entrar na guilda.</p>
            <Button asChild className="w-full"><Link href="/login">Ir para o login</Link></Button>
          </div>
        ) : invalidLink ? (
          <div className="space-y-4 text-center" role="alert">
            <KeyRound className="mx-auto h-9 w-9 text-muted-foreground" />
            <h2 className="text-xl">Link indisponível</h2>
            <p className="font-reading text-muted-foreground">Este link está incompleto, expirou ou já foi usado. Solicite um novo link para recuperar seu acesso.</p>
            <Button asChild className="w-full"><Link href="/forgot-password">Solicitar novo link</Link></Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
            <Field label="Nova senha" error={errors.password?.message} hint="Use pelo menos 8 caracteres. Evite senhas comuns ou apenas números.">
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password", {
                  required: "Informe a nova senha.",
                  minLength: { value: 8, message: "Use pelo menos 8 caracteres." },
                })} />
              </div>
            </Field>
            <Field label="Confirmar nova senha" error={errors.confirmPassword?.message}>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" type="password" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword", {
                  required: "Confirme a nova senha.",
                  validate: (value) => value === getValues("password") || "As senhas precisam ser iguais.",
                })} />
              </div>
            </Field>
            {errors.root?.message && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
            <SubmitButton loading={isSubmitting}>Salvar nova senha</SubmitButton>
          </form>
        )}
      </Scroll>
      {!saved && <Button asChild variant="ghost" className="mt-3 w-full"><Link href="/login"><ArrowLeft /> Voltar ao login</Link></Button>}
    </AuthLayout>
  );
}
