import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { evaluarEstado, motivoDenegacion, saldoPendiente, type MembresiaReglas } from "./reglas";
import { hoy, horaActualHHMM, inicioDelDia, finDelDia, diferenciaDias, formatoFecha } from "./fechas";
import { QR_PREFIX, TOTAL_LOCKERS, type EstadoSocioApp } from "./constants";
import { num } from "./formato";

/** Relaciones necesarias para evaluar el estado de un socio. */
export const includeMembresias = {
  membresias: {
    where: { estado: "ACTIVA" as const },
    include: {
      plan: true,
      pagos: { select: { monto: true } },
      congelamientos: { select: { id: true, fechaInicio: true, fechaFin: true, dias: true } },
    },
    orderBy: { fechaInicio: "desc" as const },
  },
};

export function generarQrToken(): string {
  return QR_PREFIX + randomBytes(12).toString("hex").toUpperCase();
}

/** Recalcula y persiste el estado de un socio. */
export async function sincronizarEstadoSocio(socioId: number): Promise<EstadoSocioApp | null> {
  const socio = await prisma.socio.findUnique({ where: { id: socioId }, include: includeMembresias });
  if (!socio) return null;
  const ev = evaluarEstado(socio.membresias as unknown as MembresiaReglas[], hoy());
  if (ev.estado !== socio.estado) {
    await prisma.socio.update({ where: { id: socioId }, data: { estado: ev.estado } });
  }
  return ev.estado;
}

/**
 * Sincroniza el estado de todos los socios (clasificación en tiempo real).
 * Se ejecuta al abrir los listados, el dashboard y las alertas.
 */
export async function sincronizarEstados(): Promise<void> {
  const socios = await prisma.socio.findMany({ select: { id: true, estado: true, ...includeMembresias } });
  const dia = hoy();
  const cambios: Record<EstadoSocioApp, number[]> = { ACTIVO: [], VENCIDO: [], CONGELADO: [], BLOQUEADO_POR_MORA: [] };
  for (const s of socios) {
    const ev = evaluarEstado(s.membresias as unknown as MembresiaReglas[], dia);
    if (ev.estado !== s.estado) cambios[ev.estado].push(s.id);
  }
  await Promise.all(
    (Object.keys(cambios) as EstadoSocioApp[])
      .filter((e) => cambios[e].length > 0)
      .map((estado) => prisma.socio.updateMany({ where: { id: { in: cambios[estado] } }, data: { estado } })),
  );
}

export async function cajaAbiertaDe(usuarioId: number) {
  return prisma.cajaTurno.findFirst({ where: { usuarioId, estado: "ABIERTA" }, orderBy: { apertura: "desc" } });
}

/** Primer número de locker libre (1…TOTAL_LOCKERS) o null si están todos ocupados. */
export async function siguienteLockerLibre(): Promise<number | null> {
  const ocupados = await prisma.socio.findMany({ where: { lockerNumero: { not: null } }, select: { lockerNumero: true } });
  const set = new Set(ocupados.map((o) => o.lockerNumero));
  for (let i = 1; i <= TOTAL_LOCKERS; i++) if (!set.has(i)) return i;
  return null;
}

export type ResultadoValidacion =
  | {
      permitido: true;
      socio: { id: number; nombre: string; documento: string; fotoUrl: string | null; locker: number | null };
      plan: string;
      diasRestantes: number;
      venceEl: string;
      avisos: string[];
      hora: string;
    }
  | {
      permitido: false;
      motivo: string;
      socio: { id: number; nombre: string; documento: string; fotoUrl: string | null } | null;
      hora: string;
    };

/**
 * Valida un ingreso por documento o token QR, registra la bitácora y
 * devuelve la respuesta para el kiosko (simula la señal de apertura del torniquete).
 */
export async function validarAcceso(valorCrudo: string, usuarioId: number | null): Promise<ResultadoValidacion> {
  const valor = valorCrudo.trim().toUpperCase();
  const esQr = valor.startsWith(QR_PREFIX);
  const metodo = esQr ? ("QR" as const) : ("DOCUMENTO" as const);
  const ahora = new Date();
  const dia = hoy(ahora);
  const hora = horaActualHHMM(ahora);

  const socio = await prisma.socio.findFirst({
    where: esQr ? { qrToken: valor } : { documento: valorCrudo.trim() },
    include: includeMembresias,
  });

  if (!socio) {
    const motivo = esQr ? "Código QR no registrado" : "Documento no registrado en el sistema";
    await prisma.acceso.create({ data: { valorIngresado: valorCrudo.trim().slice(0, 80), metodo, resultado: "DENEGADO", motivo, usuarioId } });
    return { permitido: false, motivo, socio: null, hora };
  }

  const ev = evaluarEstado(socio.membresias as unknown as MembresiaReglas[], dia);
  if (ev.estado !== socio.estado) await prisma.socio.update({ where: { id: socio.id }, data: { estado: ev.estado } });

  const ingresosHoy = await prisma.acceso.count({
    where: { socioId: socio.id, tipo: "SOCIO", resultado: "PERMITIDO", fecha: { gte: inicioDelDia(dia), lte: finDelDia(dia) } },
  });

  const denegado = motivoDenegacion(ev, dia, hora, ingresosHoy);
  const nombre = `${socio.nombres} ${socio.apellidos}`;
  const datosSocio = { id: socio.id, nombre, documento: socio.documento, fotoUrl: socio.fotoUrl };

  if (denegado) {
    await prisma.acceso.create({
      data: { socioId: socio.id, valorIngresado: valor.slice(0, 80), metodo, resultado: "DENEGADO", motivo: denegado.mensaje, usuarioId },
    });
    return { permitido: false, motivo: denegado.mensaje, socio: datosSocio, hora };
  }

  const vigente = ev.vigente!;
  await prisma.acceso.create({
    data: { socioId: socio.id, valorIngresado: valor.slice(0, 80), metodo, resultado: "PERMITIDO", motivo: "Torniquete liberado", usuarioId },
  });

  const avisos: string[] = [];
  if (ev.diasRestantes <= 5) avisos.push(ev.diasRestantes <= 1 ? "Último día de membresía" : `Vence en ${ev.diasRestantes} días`);
  if (ev.saldoPendienteTotal > 0) avisos.push("Tiene saldo pendiente dentro del periodo de gracia");
  if (socio.observacionesMedicas) avisos.push("Revisar observaciones médicas");

  return {
    permitido: true,
    socio: { ...datosSocio, locker: socio.lockerNumero },
    plan: vigente.plan.nombre,
    diasRestantes: ev.diasRestantes,
    venceEl: formatoFecha(vigente.fechaFinAjustada),
    avisos,
    hora,
  };
}

/** Pase diario comprado hace menos de 48 h y aún no abonado a otra membresía. */
export async function dayPassAbonable(socioId: number) {
  const limite = new Date(Date.now() - 48 * 3600 * 1000);
  return prisma.membresia.findFirst({
    where: { socioId, estado: "ACTIVA", plan: { tipo: "DIARIO" }, createdAt: { gte: limite }, abonadaEn: { is: null } },
    include: { plan: true, pagos: { select: { monto: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Resumen de saldo de una membresía. */
export async function saldoDeMembresia(membresiaId: number) {
  const m = await prisma.membresia.findUnique({ where: { id: membresiaId }, include: { pagos: { select: { monto: true } } } });
  if (!m) return null;
  return { montoTotal: num(m.montoTotal), saldo: saldoPendiente(m), m };
}

export { diferenciaDias };
