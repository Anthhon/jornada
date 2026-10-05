"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError("Username and password are required");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const res = await login(trimmedUsername, trimmedPassword);

      const accessToken = res?.data?.access;
      const refreshToken = res?.data?.refresh;

      if (!accessToken || !refreshToken) {
        throw new Error("Missing authentication tokens");
      }

      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);

      router.replace("/");
    } catch (err) {
      console.error("Login failed:", err);
      setError("Invalid username or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded shadow w-full max-w-sm space-y-4"
        noValidate
      >
        <h1 className="text-2xl font-bold text-black">Login</h1>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <input
          name="username"
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            if (error) setError("");
          }}
          placeholder="Username"
          autoComplete="username"
          className="w-full border rounded px-3 py-2 placeholder-gray-500 text-gray-700"
          aria-invalid={Boolean(error)}
        />

        <input
          name="password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError("");
          }}
          placeholder="Password"
          autoComplete="current-password"
          className="w-full border rounded px-3 py-2 placeholder-gray-500 text-gray-700"
          aria-invalid={Boolean(error)}
        />

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-2 rounded text-white ${
            isLoading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isLoading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </main>
  );
}
