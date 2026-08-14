"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo iniciar sesión.");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-[#161616] border border-white/10 rounded-2xl p-6"
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#FF00C8]/15 mb-4 mx-auto">
          <Lock size={22} className="text-[#FF00C8]" />
        </div>
        <h1 className="text-lg font-black uppercase italic text-center mb-1">
          Panel Empapados
        </h1>
        <p className="text-xs text-gray-400 text-center mb-5">
          Ingresa tu usuario y clave para continuar
        </p>

        <div className="relative mb-3">
          <User
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Usuario"
            autoFocus
            autoComplete="username"
            className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#FF00C8] transition-colors"
          />
        </div>

        <div className="relative mb-3">
          <Lock
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Clave"
            autoComplete="current-password"
            className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#FF00C8] transition-colors"
          />
        </div>

        {error && (
          <p className="text-[#FF8A00] text-xs mb-3 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || username.length === 0 || password.length === 0}
          className={`w-full py-3 rounded-xl font-bold uppercase text-sm tracking-wide transition-all ${
            loading || username.length === 0 || password.length === 0
              ? "bg-white/10 text-gray-500 cursor-not-allowed"
              : "bg-[#FF00C8] text-white shadow-[0_0_20px_rgba(255,0,200,0.5)]"
          }`}
        >
          {loading ? "Verificando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
