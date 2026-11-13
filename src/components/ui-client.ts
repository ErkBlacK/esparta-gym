// Utilidad de clases de botón reutilizable en componentes cliente (sin importar server code).
import { cn } from "@/lib/formato";

type Variante = "primary" | "secondary" | "ghost" | "danger" | "success";
const VARIANTES: Record<Variante, string> = {
  primary: "bg-fg text-bg hover:bg-fg/90",
  secondary: "border border-line bg-surface text-fg hover:bg-elevated",
  ghost: "text-muted hover:bg-elevated hover:text-fg",
  danger: "bg-bad text-white hover:bg-bad/90",
  success: "bg-ok text-white hover:bg-ok/90",
};

export function botonClases(variante: Variante = "primary", tam: "sm" | "md" | "lg" = "md") {
  const t = tam === "sm" ? "h-7 px-2.5 text-xs" : tam === "lg" ? "h-11 px-5 text-sm" : "h-9 px-3.5 text-[13px]";
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-lg font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    t,
    VARIANTES[variante],
  );
}
