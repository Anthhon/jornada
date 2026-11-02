"use client";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crest } from "@/features/journey/components/crest";
import { Field, Scroll, SubmitButton } from "@/features/journey/components/ui";
import { Link, useNavigate } from "@/lib/router-compat";
import { login } from "../services/authentication-service";
import { isAxiosError } from "axios";
import { restoreSession, useJornada } from "@/stores/journey-store";
import { CalendarDays, KeyRound, User } from "lucide-react";
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
    try {
      await login({ username, password });
      setSession({ role: "professor", name: username, username });
      navigate({ to: "/salao" });
    } catch (error) {
      const message = isAxiosError(error) && error.response?.status === 401
        ? "Usuário ou senha não conferem."
        : "Não foi possível acessar a API. Verifique a conexão e tente novamente.";
      setError("root", { message });
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="page-enter w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Crest className="h-16 w-16" />
          <h1 className="mt-4 text-center text-2xl">Debuggers &amp; Developers</h1><p className="mt-3 text-sm text-muted-foreground">Área do professor</p>
          <p className="mt-1 font-reading text-muted-foreground">Cada jornada começa com um passo.</p>
        </div>
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
            {errors.root?.message && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.root.message}</p>}
            <SubmitButton loading={loading}>Entrar na guilda</SubmitButton>
          </form>
        </Scroll>
        <Button asChild variant="ghost" className="mt-3 w-full"><Link to="/"><CalendarDays /> Voltar à página inicial</Link></Button>
      </div>
    </main>
  );
}

export { Login as LoginPage };
