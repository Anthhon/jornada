"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "@/types/user";
import { getUsers } from "@/lib/api";

export default function Home() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Redirect in case user is not authenticated
        const token = localStorage.getItem("access_token");
        if (!token) {
            router.push("/login");
            return;
        }

        // Gather users list info
        getUsers()
        .then((res) => setUsers(res.data))
        .catch((err) => console.error("Failed to fetch users", err))
        .finally(() => setLoading(false));
    }, [router]);

    // Log-out handler
    // TODO: A problem related to this logout method, is that the token is only deleted in the front-end
    // remaining valid in the back-end itself, for prototyping reasons this will not be a problem, but 
    // this problem should be solved later at some point
    const handleLogout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        router.push("/login");
    };

    // Renders users list
    return (
        <main className="min-h-screen bg-gray-100 flex flex-col items-center pt-16 px-4">
        <h1 className="text-3xl font-bold text-gray-800">Usuários</h1>
        <p className="text-sm text-gray-800 mb-6">Lista de todos os usuários cadastrados</p>

        {loading ? (
            <p className="text-gray-500">Carregando...</p>
        ) : (
        <ul className="w-full max-w-md space-y-2">
        {users.map((u) => (
            <li
            key={u.id}
            className="bg-white shadow rounded px-4 py-2 flex flex-row gap-2 items-center justify-between"
            >
            <span className="text-center text-sm text-gray-500">{u.id}</span>
            <span className="text-center font-semibold text-gray-800">{u.username}</span>
            <span className="text-center text-sm text-gray-500">{u.date_joined}</span>
            </li>
        ))}
        </ul>
        )}

        <div className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-6 rounded m-4">
        <button onClick={handleLogout} className="text-sm text-white-500 hover:text-white-700">Deslogar</button>
        </div>
        </main>
    );
}
