"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    // Login handler
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await login(username, password);
            localStorage.setItem("access_token", res.data.access);
            localStorage.setItem("refresh_token", res.data.refresh);
            router.push("/");
        } catch {
            setError("Invalid username or password");
        }
    };

    // Returns a login form in case user is not authenticated
    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <form onSubmit={handleLogin} className="bg-white p-6 rounded shadow w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-black">Login</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full border rounded px-3 py-2 placeholder-gray-500 text-gray-500" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full border rounded px-3 py-2 placeholder-gray-500 text-gray-500" />
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">Log in</button>
        </form>
        </main>
    );
}
