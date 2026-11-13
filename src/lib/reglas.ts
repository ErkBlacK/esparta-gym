// Motor de reglas de negocio (funciones puras, sin acceso a base de datos).
// Se usa en el kiosko, en el cálculo del estado del socio, en ventas y en alertas.

import { GRACIA_MORA_DIAS, type EstadoSocioApp } from "./constants";
import { diaSemanaISO, diferenciaDias, formatoDiaMes, formatoFecha, sumarDias } from "./fechas";
import { formatoMoneda, num } from "./formato";

export type PlanReglas = {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  duracionDias: number;
  precio: unknown;
  invitadosMes: number;
  maxDiasCongelamiento: number;
  accesosPorDia: number;
  horaInicio: string;
  horaFin: string;
  diasPermitidos: string;
  lockerIncluido: boolean;
};

export type MembresiaReglas = {
  id: number;
  fechaInicio: Date;
  fechaFin: Date;
  fechaFinAjustada: Date;
  montoTotal: unknown;
  diasCongelados: number;
  estado: string;
  createdAt: Date;
  plan: PlanReglas;
  pagos: { monto: unknown }[];
  congelamientos: { id: number; fechaInicio: Date; fechaFin: Date; dias: number }[];
};

export type EvaluacionEstado = {
  estado: EstadoSocioApp;
  vigente: MembresiaReglas | null;
  proxima: MembresiaReglas | null;
  ultimaVencida: MembresiaReglas | null;
  congelamientoActual: MembresiaReglas["congelamientos"][number] | null;
  membresiaEnMora: MembresiaReglas | null;
  saldoPendienteTotal: number;
  diasRestantes: number;
};

export function totalPagado(m: Pick<MembresiaReglas, "pagos">): number {
  return m.pagos.reduce((acc, p) => acc + num(p.monto), 0);
}

export function saldoPendiente(m: Pick<MembresiaReglas, "pagos" | "montoTotal">): number {
  return Math.max(0, Math.round((num(m.montoTotal) - totalPagado(m)) * 100) / 100);
}

export function congelamientoEn(m: MembresiaReglas, dia: Date) {
  return m.congelamientos.find((c) => c.fechaInicio <= dia && dia <= c.fechaFin) ?? null;
}

/**
 * Calcula el estado en tiempo real de un socio a partir de sus membresías.
 * Prioridad: BLOQUEADO_POR_MORA > CONGELADO > ACTIVO > VENCIDO.
 */
export function evaluarEstado(membresias: MembresiaReglas[], dia: Date): EvaluacionEstado {
  const activas = membresias.filter((m) => m.estado === "ACTIVA");
  const ordenadas = [...activas].sort((a, b) => b.fechaInicio.getTime() - a.fechaInicio.getTime());

  const vigente = ordenadas.find((m) => m.fechaInicio <= dia && dia <= m.fechaFinAjustada) ?? null;
  const proxima =
    [...activas].filter((m) => m.fechaInicio > dia).sort((a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime())[0] ?? null;
  const ultimaVencida =
    [...activas].filter((m) => m.fechaFinAjustada < dia).sort((a, b) => b.fechaFinAjustada.getTime() - a.fechaFinAjustada.getTime())[0] ??
    null;

  let saldoPendienteTotal = 0;
  let membresiaEnMora: MembresiaReglas | null = null;
  for (const m of activas) {
    const saldo = saldoPendiente(m);
    saldoPendienteTotal += saldo;
    if (saldo > 0 && diferenciaDias(m.fechaInicio, dia) > GRACIA_MORA_DIAS && !membresiaEnMora) membresiaEnMora = m;
  }

  const congelamientoActual = vigente ? congelamientoEn(vigente, dia) : null;
  const diasRestantes = vigente ? Math.max(0, diferenciaDias(dia, vigente.fechaFinAjustada) + 1) : 0;

  let estado: EstadoSocioApp = "VENCIDO";
  if (membresiaEnMora) estado = "BLOQUEADO_POR_MORA";
  else if (congelamientoActual) estado = "CONGELADO";
  else if (vigente) estado = "ACTIVO";

  return { estado, vigente, proxima, ultimaVencida, congelamientoActual, membresiaEnMora, saldoPendienteTotal, diasRestantes };
}

const DIAS_ABREV = ["", "L", "M", "X", "J", "V", "S", "D"];

export function describirDias(diasPermitidos: string): string {
  const dias = diasPermitidos.split(",").map((d) => Number(d.trim())).filter((d) => d >= 1 && d <= 7).sort();
  if (dias.length === 7) return "Todos los días";
  if (dias.join(",") === "1,2,3,4,5,6") return "Lun a Sáb";
  if (dias.join(",") === "1,2,3,4,5") return "Lun a Vie";
  return dias.map((d) => DIAS_ABREV[d]).join(" ");
}

/** Verifica día y franja horaria permitidos por el plan. */
export function dentroDeHorario(plan: PlanReglas, dia: Date, horaHHMM: string): boolean {
  const dias = plan.diasPermitidos.split(",").map((d) => Number(d.trim()));
  if (!dias.includes(diaSemanaISO(dia))) return false;
  return horaHHMM >= plan.horaInicio && horaHHMM <= plan.horaFin;
}

export type MotivoDenegado = { codigo: string; mensaje: string };

/**
 * Decide si un socio puede ingresar. Devuelve null si está permitido o el motivo exacto.
 */
export function motivoDenegacion(
  ev: EvaluacionEstado,
  dia: Date,
  horaHHMM: string,
  ingresosHoy: number,
): MotivoDenegado | null {
  if (ev.membresiaEnMora) {
    return {
      codigo: "MORA",
      mensaje: `Saldo pendiente de ${formatoMoneda(saldoPendiente(ev.membresiaEnMora))} en ${ev.membresiaEnMora.plan.nombre}`,
    };
  }
  if (ev.congelamientoActual) {
    return { codigo: "CONGELADA", mensaje: `Membresía congelada hasta el ${formatoFecha(ev.congelamientoActual.fechaFin)}` };
  }
  if (!ev.vigente) {
    if (ev.proxima) return { codigo: "NO_INICIA", mensaje: `La membresía inicia el ${formatoFecha(ev.proxima.fechaInicio)}` };
    if (ev.ultimaVencida)
      return { codigo: "VENCIDA", mensaje: `Membresía vencida el ${formatoDiaMes(ev.ultimaVencida.fechaFinAjustada)}` };
    return { codigo: "SIN_MEMBRESIA", mensaje: "No tiene membresía registrada" };
  }
  const plan = ev.vigente.plan;
  if (!dentroDeHorario(plan, dia, horaHHMM)) {
    return {
      codigo: "HORARIO",
      mensaje: `Fuera de horario permitido (${describirDias(plan.diasPermitidos)} ${plan.horaInicio}–${plan.horaFin})`,
    };
  }
  if (plan.accesosPorDia > 0 && ingresosHoy >= plan.accesosPorDia) {
    return {
      codigo: "LIMITE",
      mensaje: `Límite de ${plan.accesosPorDia} ingreso${plan.accesosPorDia > 1 ? "s" : ""} diario${plan.accesosPorDia > 1 ? "s" : ""} alcanzado`,
    };
  }
  return null;
}

/** Fecha sugerida de inicio para una nueva membresía (renovación encadenada). */
export function inicioSugerido(membresias: MembresiaReglas[], dia: Date, esPaseDiario: boolean): Date {
  if (esPaseDiario) return dia;
  const regulares = membresias.filter((m) => m.estado === "ACTIVA" && m.plan.tipo !== "DIARIO" && m.fechaFinAjustada >= dia);
  if (regulares.length === 0) return dia;
  const ultimaFin = regulares.reduce((max, m) => (m.fechaFinAjustada > max ? m.fechaFinAjustada : max), regulares[0]!.fechaFinAjustada);
  return sumarDias(ultimaFin, 1);
}

/** Fecha de fin según la duración del plan (incluye el día de inicio). */
export function calcularFin(inicio: Date, duracionDias: number): Date {
  return sumarDias(inicio, Math.max(1, duracionDias) - 1);
}

/** Días entre dos fechas incluyendo ambos extremos. */
export function diasInclusivos(inicio: Date, fin: Date): number {
  return diferenciaDias(inicio, fin) + 1;
}

/** Valida un congelamiento contra las reglas del plan. Devuelve mensaje de error o null. */
export function validarCongelamiento(m: MembresiaReglas, inicio: Date, fin: Date, dia: Date): string | null {
  if (m.plan.maxDiasCongelamiento <= 0) return `El plan ${m.plan.nombre} no permite congelamientos.`;
  if (fin < inicio) return "La fecha final debe ser posterior a la inicial.";
  if (inicio < dia) return "El congelamiento no puede iniciar en una fecha pasada.";
  if (inicio < m.fechaInicio || inicio > m.fechaFinAjustada) return "La fecha inicial debe estar dentro de la vigencia de la membresía.";
  const dias = diasInclusivos(inicio, fin);
  const disponibles = m.plan.maxDiasCongelamiento - m.diasCongelados;
  if (dias > disponibles) return `Solo quedan ${disponibles} día(s) de congelamiento disponibles (máximo ${m.plan.maxDiasCongelamiento}).`;
  const traslape = m.congelamientos.some((c) => inicio <= c.fechaFin && fin >= c.fechaInicio);
  if (traslape) return "El rango se cruza con otro congelamiento existente.";
  return null;
}
