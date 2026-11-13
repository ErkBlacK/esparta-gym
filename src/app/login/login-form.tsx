"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { botonClases } from "@/components/ui-client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      redirect: false,
    });
    setCargando(false);
    if (!res || res.error) {
      setError("Correo o contraseña incorrectos, o el usuario está inactivo.");
      return;
    }
    const destino = params.get("callbackUrl");
    router.replace(destino && destino.startsWith("/") ? destino : "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="mt-6 space-y-4">
      <label className="block">
        <span className="label">Correo</span>
        <input name="email" type="email" required autoComplete="username" className="input h-10" placeholder="nombre@forjagym.co" />
      </label>
      <label className="block">
        <span className="label">Contraseña</span>
        <input name="password" type="password" required autoComplete="current-password" className="input h-10" placeholder="••••••••" />
      </label>
      {error && <div className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad ring-1 ring-inset ring-bad/20">{error}</div>}
      <button type="submit" disabled={cargando} className={botonClases("primary", "lg") + " w-full"}>
        {cargando ? "Validando…" : "Entrar"}
      </button>
    </form>
  );
}
