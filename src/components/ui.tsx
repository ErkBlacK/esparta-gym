import Link from "next/link";
import type { ReactNode } from "react";
import { cn, iniciales } from "@/lib/formato";
import { botonClases } from "./ui-client";
import { ESTADO_LABEL, type EstadoSocioApp } from "@/lib/constants";

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-1 font-mono text-2xs uppercase tracking-[0.18em] text-subtle">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tono = "ok" | "bad" | "warn" | "info" | "neutral";

const TONOS: Record<Tono, string> = {
  ok: "bg-ok-soft text-ok ring-ok/20",
  bad: "bg-bad-soft text-bad ring-bad/20",
  warn: "bg-warn-soft text-warn ring-warn/20",
  info: "bg-info-soft text-info ring-info/20",
  neutral: "bg-elevated text-muted ring-line",
};

export function Badge({ tono = "neutral", children, punto = true, className }: { tono?: Tono; children: ReactNode; punto?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-2xs font-medium ring-1 ring-inset", TONOS[tono], className)}>
      {punto && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const TONO_ESTADO: Record<EstadoSocioApp, Tono> = {
  ACTIVO: "ok",
  VENCIDO: "neutral",
  CONGELADO: "warn",
  BLOQUEADO_POR_MORA: "bad",
};

export function EstadoBadge({ estado }: { estado: EstadoSocioApp }) {
  return <Badge tono={TONO_ESTADO[estado]}>{ESTADO_LABEL[estado]}</Badge>;
}

type Variante = "primary" | "secondary" | "ghost" | "danger" | "success";
export { botonClases };

export function ButtonLink({ href, children, variante = "primary", tam = "md", className }: { href: string; children: ReactNode; variante?: Variante; tam?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <Link href={href} className={cn(botonClases(variante, tam), className)}>
      {children}
    </Link>
  );
}

export function Stat({ label, value, hint, tono, className }: { label: string; value: ReactNode; hint?: ReactNode; tono?: Tono; className?: string }) {
  const color = tono === "ok" ? "text-ok" : tono === "bad" ? "text-bad" : tono === "warn" ? "text-warn" : "text-fg";
  return (
    <Card className={cn("flex flex-col p-5", className)}>
      <div className="text-xs text-muted">{label}</div>
      <div className={cn("mt-3 whitespace-nowrap text-2xl font-semibold leading-none tracking-tight tabular", color)}>{value}</div>
      {hint && <div className="mt-2 text-xs text-subtle">{hint}</div>}
    </Card>
  );
}

export function Vacio({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 h-8 w-8 rounded-lg border border-dashed border-line" />
      <div className="text-[13px] font-medium">{titulo}</div>
      {descripcion && <p className="mt-1 max-w-sm text-xs text-muted">{descripcion}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function Avatar({ nombre, foto, tam = 36, className }: { nombre: string; foto?: string | null; tam?: number; className?: string }) {
  if (foto) {
    return <img src={foto} alt={nombre} width={tam} height={tam} className={cn("shrink-0 rounded-full object-cover ring-1 ring-line", className)} style={{ width: tam, height: tam }} />;
  }
  // Tono determinista por nombre (escala de grises sobria)
  const h = Array.from(nombre).reduce((a, c) => a + c.charCodeAt(0), 0);
  const tonos = ["bg-zinc-700", "bg-zinc-600", "bg-stone-600", "bg-neutral-700", "bg-slate-600"];
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full font-medium text-white/90 ring-1 ring-line", tonos[h % tonos.length], className)}
      style={{ width: tam, height: tam, fontSize: Math.max(10, tam * 0.36) }}
    >
      {iniciales(nombre)}
    </div>
  );
}

export function Campo({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-2xs text-subtle">{hint}</span>}
    </label>
  );
}

export function Filtros({ opciones, actual, param, base }: { opciones: { valor: string; label: string; total?: number }[]; actual: string; param: string; base: string }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
      {opciones.map((o) => {
        const activo = o.valor === actual;
        const sep = base.includes("?") ? "&" : "?";
        const href = o.valor ? `${base}${sep}${param}=${encodeURIComponent(o.valor)}` : base;
        return (
          <Link
            key={o.valor || "todos"}
            href={href}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition",
              activo ? "bg-elevated text-fg ring-1 ring-line" : "text-muted hover:text-fg",
            )}
          >
            {o.label}
            {o.total !== undefined && <span className="font-mono text-2xs text-subtle">{o.total}</span>}
          </Link>
        );
      })}
    </div>
  );
}

/** Barra de progreso fina (uso de cupos, aforo, días). */
export function Progreso({ valor, max, tono = "ok" }: { valor: number; max: number; tono?: "ok" | "warn" | "bad" }) {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0;
  const color = tono === "bad" ? "bg-bad" : tono === "warn" ? "bg-warn" : "bg-ok";
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-elevated">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
