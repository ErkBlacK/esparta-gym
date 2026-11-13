import "server-only";
import { prisma } from "./prisma";
import { diferenciaDias, finDelDia, formatoDiaMes, fechaLocal, inicioDelDia, isoFecha, partesLocales, sumarDias } from "./fechas";
import { num } from "./formato";

/** Ingresos agrupados por día local dentro del rango. */
export async function ingresosPorDia(desde: Date, hasta: Date) {
  const pagos = await prisma.pago.findMany({ where: { fecha: { gte: inicioDelDia(desde), lte: finDelDia(hasta) } }, select: { fecha: true, monto: true, metodo: true } });
  const mapa = new Map<string, number>();
  const n = diferenciaDias(desde, hasta);
  for (let i = 0; i <= n; i++) mapa.set(isoFecha(sumarDias(desde, i)), 0);
  const porMetodo = { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0 };
  for (const p of pagos) {
    const k = isoFecha(fechaLocal(p.fecha));
    mapa.set(k, (mapa.get(k) ?? 0) + num(p.monto));
    porMetodo[p.metodo] += num(p.monto);
  }
  const serie = [...mapa.entries()].map(([k, total]) => ({ dia: formatoDiaMes(new Date(k + "T00:00:00Z")), fecha: k, total }));
  const total = serie.reduce((a, s) => a + s.total, 0);
  return { serie, total, porMetodo, cantidad: pagos.length };
}

/** Ingresos permitidos por hora del día (horas pico). */
export async function horasPico(desde: Date, hasta: Date) {
  const accesos = await prisma.acceso.findMany({
    where: { resultado: "PERMITIDO", fecha: { gte: inicioDelDia(desde), lte: finDelDia(hasta) } },
    select: { fecha: true },
  });
  const horas = Array.from({ length: 24 }, (_, h) => ({ hora: String(h).padStart(2, "0"), accesos: 0 }));
  for (const a of accesos) horas[partesLocales(a.fecha).h]!.accesos++;
  const desdeH = horas.findIndex((h) => h.accesos > 0);
  const hastaH = 23 - [...horas].reverse().findIndex((h) => h.accesos > 0);
  const recorte = desdeH === -1 ? horas.slice(5, 23) : horas.slice(Math.min(desdeH, 5), Math.max(hastaH, 22) + 1);
  const pico = horas.reduce((m, h) => (h.accesos > m.accesos ? h : m), horas[0]!);
  return { serie: recorte, pico, total: accesos.length };
}

/** Membresías vendidas por plan dentro del rango. */
export async function ventasPorPlan(desde: Date, hasta: Date) {
  const ms = await prisma.membresia.findMany({
    where: { createdAt: { gte: inicioDelDia(desde), lte: finDelDia(hasta) }, estado: "ACTIVA" },
    select: { montoTotal: true, plan: { select: { nombre: true } } },
  });
  const mapa = new Map<string, { plan: string; ventas: number; ingresos: number }>();
  for (const m of ms) {
    const k = m.plan.nombre;
    const e = mapa.get(k) ?? { plan: k, ventas: 0, ingresos: 0 };
    e.ventas++;
    e.ingresos += num(m.montoTotal);
    mapa.set(k, e);
  }
  return [...mapa.values()].sort((a, b) => b.ventas - a.ventas);
}

/** Accesos permitidos vs denegados por día. */
export async function accesosPorDia(desde: Date, hasta: Date) {
  const accesos = await prisma.acceso.findMany({ where: { fecha: { gte: inicioDelDia(desde), lte: finDelDia(hasta) } }, select: { fecha: true, resultado: true, motivo: true } });
  const mapa = new Map<string, { dia: string; permitidos: number; denegados: number }>();
  const n = diferenciaDias(desde, hasta);
  for (let i = 0; i <= n; i++) {
    const f = sumarDias(desde, i);
    mapa.set(isoFecha(f), { dia: formatoDiaMes(f), permitidos: 0, denegados: 0 });
  }
  const motivos = new Map<string, number>();
  for (const a of accesos) {
    const e = mapa.get(isoFecha(fechaLocal(a.fecha)));
    if (!e) continue;
    if (a.resultado === "PERMITIDO") e.permitidos++;
    else {
      e.denegados++;
      const clave = categoriaMotivo(a.motivo);
      motivos.set(clave, (motivos.get(clave) ?? 0) + 1);
    }
  }
  return {
    serie: [...mapa.values()],
    motivos: [...motivos.entries()].map(([motivo, total]) => ({ motivo, total })).sort((a, b) => b.total - a.total),
  };
}

/** Agrupa los motivos de denegación en categorías legibles. */
export function categoriaMotivo(motivo: string | null): string {
  const m = (motivo ?? "").toLowerCase();
  if (m.includes("vencida")) return "Membresía vencida";
  if (m.includes("saldo")) return "Saldo pendiente";
  if (m.includes("congelada")) return "Membresía congelada";
  if (m.includes("horario")) return "Fuera de horario";
  if (m.includes("límite")) return "Límite diario alcanzado";
  if (m.includes("no registrado")) return "No registrado";
  if (m.includes("inicia")) return "Membresía aún no inicia";
  if (m.includes("no tiene membresía")) return "Sin membresía";
  return motivo || "Sin motivo";
}
