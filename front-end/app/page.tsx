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
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Users</h1>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <ul className="w-full max-w-md space-y-2">
          {users.map((u) => (
            <li
              key={u.id}
              className="bg-white shadow rounded px-4 py-2 flex flex-col"
            >
              <span className="font-semibold">{u.username}</span>
              <span className="text-sm text-gray-500">{u.email}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
