"use client";

import { useEffect, useState } from "react";
import { User } from "@/types/user";
import { getUsers } from "@/lib/api";

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUsers()
      .then((res) => setUsers(res.data))
      .catch((err) => console.error("Failed to fetch users", err))
      .finally(() => setLoading(false));
  }, []);

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
    </main>
  );
}
