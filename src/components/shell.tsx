"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/formato";
import type { Modulo } from "@/lib/permisos";

export function Sidebar({ modulos, gym }: { modulos: Modulo[]; gym: string }) {
  const pathname = usePathname();
  const grupos = ["General", "Operación", "Gestión"] as const;
  return (
    <nav className="flex h-full flex-col">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-3 pb-6 pt-1">
        <Marca />
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tight">{gym}</div>
          <div className="font-mono text-2xs text-subtle">control de acceso</div>
        </div>
      </Link>
      <div className="flex-1 space-y-5 overflow-y-auto">
        {grupos.map((g) => {
          const items = modulos.filter((m) => m.grupo === g);
          if (items.length === 0) return null;
          return (
            <div key={g}>
              <div className="px-3 pb-1.5 text-2xs font-medium uppercase tracking-[0.14em] text-subtle">{g}</div>
              <ul className="space-y-px">
                {items.map((m) => {
                  const activo = pathname === m.href || pathname.startsWith(m.href + "/");
                  return (
                    <li key={m.href}>
                      <Link
                        href={m.href}
                        className={cn(
                          "group relative flex h-8 items-center rounded-md px-3 text-[13px] transition",
                          activo ? "bg-elevated font-medium text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg",
                        )}
                      >
                        {activo && <span className="absolute -left-3 top-1.5 h-5 w-[2px] rounded-full bg-ok" />}
                        {m.label}
                        {m.href === "/kiosko" && <span className="ml-auto h-1.5 w-1.5 animate-pulsar rounded-full bg-ok" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export function Marca({ tam = 28 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="8" className="fill-fg" />
      <path d="M9 11h14M9 16h9M9 21h5" stroke="#10B981" strokeWidth="2.6" strokeLinecap="round" className="dark:stroke-[#10B981]" />
      <circle cx="22" cy="21" r="2.2" fill="#10B981" />
    </svg>
  );
}

export function ThemeToggle() {
  const [oscuro, setOscuro] = useState(true);
  useEffect(() => setOscuro(document.documentElement.classList.contains("dark")), []);
  function alternar() {
    const nuevo = !oscuro;
    setOscuro(nuevo);
    document.documentElement.classList.toggle("dark", nuevo);
    try {
      localStorage.setItem("tema", nuevo ? "dark" : "light");
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={alternar}
      className="inline-flex h-8 items-center gap-2 rounded-md border border-line px-2.5 text-xs text-muted transition hover:text-fg"
      aria-label="Cambiar tema"
    >
      <span className={cn("h-2.5 w-2.5 rounded-full ring-1 ring-line", oscuro ? "bg-zinc-900" : "bg-white")} />
      {oscuro ? "Oscuro" : "Claro"}
    </button>
  );
}

export function BotonSalir() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="inline-flex h-8 items-center rounded-md px-2.5 text-xs text-muted transition hover:bg-elevated hover:text-fg"
    >
      Cerrar sesión
    </button>
  );
}

export function MenuMovil({ modulos, gym }: { modulos: Modulo[]; gym: string }) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();
  useEffect(() => setAbierto(false), [pathname]);
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setAbierto(true)} className="inline-flex h-8 items-center rounded-md border border-line px-2.5 text-xs">
        Menú
      </button>
      {abierto && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAbierto(false)} />
          <div className="relative h-full w-64 border-r border-line bg-surface p-4 animate-fade-in">
            <Sidebar modulos={modulos} gym={gym} />
          </div>
        </div>
      )}
    </div>
  );
}
