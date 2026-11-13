// Utilidades de fechas con zona horaria del negocio.
// Convención: los campos "solo fecha" (DATE) se representan como Date a medianoche UTC
// del día calendario local. Los instantes (DATETIME) son Date reales.

export const TZ = process.env.APP_TIMEZONE || "America/Bogota";
const DIA_MS = 86_400_000;

type Partes = { y: number; m: number; d: number; h: number; min: number; dow: number };

const fmtPartes = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Partes de calendario/hora de un instante en la zona del negocio. */
export function partesLocales(instante: Date = new Date()): Partes {
  const p: Record<string, string> = {};
  for (const part of fmtPartes.formatToParts(instante)) p[part.type] = part.value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour) % 24,
    min: Number(p.minute),
    dow: DOW[p.weekday] ?? 1,
  };
}

/** Fecha (solo día) de hoy en la zona del negocio. */
export function hoy(instante: Date = new Date()): Date {
  const p = partesLocales(instante);
  return new Date(Date.UTC(p.y, p.m - 1, p.d));
}

/** Convierte un instante a su fecha local (solo día). */
export function fechaLocal(instante: Date): Date {
  return hoy(instante);
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * DIA_MS);
}

/** Diferencia en días calendario (b - a) entre fechas "solo día". */
export function diferenciaDias(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DIA_MS);
}

/** Día ISO (1 = lunes … 7 = domingo) de una fecha "solo día". */
export function diaSemanaISO(fecha: Date): number {
  const d = fecha.getUTCDay();
  return d === 0 ? 7 : d;
}

/** "YYYY-MM-DD" → Date (medianoche UTC). Devuelve null si es inválida. */
export function parseFecha(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
  if (!m) return null;
  const f = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(f.getTime()) ? null : f;
}

/** Date "solo día" → "YYYY-MM-DD". */
export function isoFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function offsetMinutos(instante: Date): number {
  const p = partesLocales(instante);
  const comoUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  return Math.round((comoUtc - Math.floor(instante.getTime() / 60000) * 60000) / 60000);
}

/** Instante real en que comienza (00:00 local) una fecha "solo día". */
export function inicioDelDia(fecha: Date): Date {
  const aprox = new Date(fecha.getTime());
  const off = offsetMinutos(aprox);
  return new Date(fecha.getTime() - off * 60000);
}

/** Instante real en que termina (fin del día local) una fecha "solo día". */
export function finDelDia(fecha: Date): Date {
  return new Date(inicioDelDia(sumarDias(fecha, 1)).getTime() - 1);
}

/** Primer día del mes local de una fecha "solo día". */
export function inicioDeMes(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
}

const fmtFechaCorta = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const fmtDiaMes = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const fmtFechaLarga = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtFechaHora = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TZ,
});
const fmtHora = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ });

/** dd/mm/aaaa de una fecha "solo día". */
export const formatoFecha = (f: Date | null | undefined) => (f ? fmtFechaCorta.format(f) : "—");
/** dd/mm de una fecha "solo día". */
export const formatoDiaMes = (f: Date) => fmtDiaMes.format(f);
/** 12 nov 2026 de una fecha "solo día". */
export const formatoFechaLarga = (f: Date | null | undefined) => (f ? fmtFechaLarga.format(f) : "—");
/** dd/mm/aaaa hh:mm de un instante, en la zona del negocio. */
export const formatoFechaHora = (f: Date | null | undefined) => (f ? fmtFechaHora.format(f) : "—");
/** hh:mm de un instante, en la zona del negocio. */
export const formatoHora = (f: Date) => fmtHora.format(f);

/** Hora local actual en formato HH:MM. */
export function horaActualHHMM(instante: Date = new Date()): string {
  const p = partesLocales(instante);
  return `${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`;
}
