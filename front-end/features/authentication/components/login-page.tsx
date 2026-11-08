"use client";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout } from "./auth-layout";
import { Field, Scroll, SubmitButton } from "@/features/journey/components/ui";
import { Link, useNavigate } from "@/lib/router-compat";
import { MOCKING_ENABLED } from "@/lib/api-config";
import { login } from "../services/authentication-service";
import { isAxiosError } from "axios";
import { restoreSession, useJornada } from "@/stores/journey-store";
import { CalendarDays, KeyRound, User } from "@/components/icons/rpg-icons";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { LoginValues } from "../types/login";



function Login() {
  const navigate = useNavigate();
  const setSession = useJornada((s) => s.setSession);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting: loading } } = useForm<LoginValues>({ defaultValues: { username: "", password: "" } });

  useEffect(() => {
    restoreSession();
    if (useJornada.getState().session?.role === "professor") navigate({ to: "/salao" });
  }, [navigate]);

  async function submit({ username, password }: LoginValues) {
    const normalizedUsername = username.trim();
    try {
      await login({ username: normalizedUsername, password });
      setSession({ role: "professor", name: normalizedUsername, username: normalizedUsername });
      navigate({ to: "/salao" });
    } catch (error) {
      const message = isAxiosError(error) && error.response?.status === 401
        ? "Usuário ou senha não conferem."
        : "Não foi possível acessar a API. Verifique a conexão e tente novamente.";
      setError("root", { message });
    }
  }

  return (
    <AuthLayout>
      <Scroll className="p-8">
        <form onSubmit={handleSubmit(submit)} className="space-y-5" noValidate>
          <Field label="Usuário" error={errors.username?.message}>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" {...register("username", { validate: (value) => !!value.trim() || "Informe o usuário." })} autoComplete="username" placeholder="professor" />
            </div>
          </Field>
          <Field label="Senha" error={errors.password?.message}>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" type="password" {...register("password", { required: "Informe a senha." })} autoComplete="current-password" />
            </div>
          </Field>
          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Esqueci minha senha</Link>
          </div>
          {errors.root?.message && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.root.message}</p>}
          <SubmitButton loading={loading}>Entrar na guilda</SubmitButton>
        </form>
      </Scroll>
      {MOCKING_ENABLED && <p className="mt-5 text-center text-xs text-muted-foreground">Demonstração: professor / jornada123</p>}
      <Button asChild variant="ghost" className="mt-3 w-full"><Link to="/"><CalendarDays /> Voltar à página inicial</Link></Button>
    </AuthLayout>
  );
}

export { Login as LoginPage };
