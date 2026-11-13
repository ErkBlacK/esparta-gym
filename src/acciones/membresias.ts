"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirPermiso } from "@/lib/auth";
import { campo, campoNumero, ejecutar, ErrorNegocio, type EstadoAccion } from "@/lib/acciones";
import { cajaAbiertaDe, dayPassAbonable, includeMembresias, siguienteLockerLibre, sincronizarEstadoSocio } from "@/lib/servicios";
import { calcularFin, inicioSugerido, saldoPendiente, type MembresiaReglas } from "@/lib/reglas";
import { formatoFecha, hoy, parseFecha } from "@/lib/fechas";
import { formatoMoneda, num } from "@/lib/formato";
import { METODOS_PAGO } from "@/lib/constants";

function metodoValido(m: string) {
  if (!(METODOS_PAGO as readonly string[]).includes(m)) throw new ErrorNegocio("Selecciona un método de pago válido.");
  return m as (typeof METODOS_PAGO)[number];
}

/**
 * Venta de membresía:
 * - Encadena la fecha de inicio si el socio tiene una membresía vigente (renovación).
 * - Aplica el abono del pase diario comprado en las últimas 48 h.
 * - Asigna locker automáticamente en planes Elite.
 * - Registra el pago inicial (total o abono) en la caja abierta del usuario.
 */
export async function venderMembresia(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    const usuario = await requerirPermiso("venderMembresia");
    const socioId = Number(campo(fd, "socioId"));
    const planId = Number(campo(fd, "planId"));
    const pagoInicial = campoNumero(fd, "pagoInicial");
    const metodo = campo(fd, "metodo");
    const referencia = campo(fd, "referencia") || null;

    const [socio, plan] = await Promise.all([
      prisma.socio.findUnique({ where: { id: socioId }, include: includeMembresias }),
      prisma.plan.findUnique({ where: { id: planId } }),
    ]);
    if (!socio) throw new ErrorNegocio("Socio no encontrado.");
    if (!plan || !plan.activo) throw new ErrorNegocio("Selecciona un plan activo.");
    if (!Number.isFinite(pagoInicial) || pagoInicial < 0) throw new ErrorNegocio("El valor del pago inicial no es válido.");

    const dia = hoy();
    const esDiario = plan.tipo === "DIARIO";
    const membresias = socio.membresias as unknown as MembresiaReglas[];
    const sugerido = inicioSugerido(membresias, dia, esDiario);
    const inicio = parseFecha(campo(fd, "fechaInicio")) ?? sugerido;
    if (inicio < dia) throw new ErrorNegocio("La membresía no puede iniciar en una fecha pasada.");
    const fin = calcularFin(inicio, plan.duracionDias);

    // Regla de traslape: no puede haber dos membresías regulares en el mismo periodo.
    if (!esDiario) {
      const choca = membresias.find((m) => m.plan.tipo !== "DIARIO" && inicio <= m.fechaFinAjustada && fin >= m.fechaInicio);
      if (choca) throw new ErrorNegocio(`Se cruza con ${choca.plan.nombre} vigente hasta el ${formatoFecha(choca.fechaFinAjustada)}. Usa la fecha sugerida ${formatoFecha(sugerido)}.`);
    } else {
      const diaPaseOcupado = membresias.find((m) => m.fechaInicio <= inicio && inicio <= m.fechaFinAjustada);
      if (diaPaseOcupado) throw new ErrorNegocio(`El socio ya tiene acceso ese día con ${diaPaseOcupado.plan.nombre}.`);
    }

    // Regla del pase diario: abono si compra membresía regular dentro de las 48 h.
    let descuento = 0;
    let abonoDayPassId: number | null = null;
    if (!esDiario && fd.get("aplicarAbono") !== "no") {
      const dp = await dayPassAbonable(socioId);
      if (dp) {
        descuento = Math.min(num(dp.precioLista), dp.pagos.reduce((a, p) => a + num(p.monto), 0));
        abonoDayPassId = dp.id;
      }
    }
    const precio = num(plan.precio);
    const montoTotal = Math.max(0, precio - descuento);
    if (pagoInicial > montoTotal) throw new ErrorNegocio(`El pago no puede superar el total (${formatoMoneda(montoTotal)}).`);
    if (esDiario && pagoInicial < montoTotal) throw new ErrorNegocio("El pase diario debe pagarse completo.");

    let caja = null;
    if (pagoInicial > 0) {
      metodoValido(metodo);
      caja = await cajaAbiertaDe(usuario.id);
      if (!caja) throw new ErrorNegocio("Debes abrir tu caja de turno antes de registrar pagos (Caja y pagos → Abrir caja).");
    }

    let locker: number | null = socio.lockerNumero;
    if (plan.lockerIncluido && !locker) locker = await siguienteLockerLibre();

    await prisma.$transaction(async (tx) => {
      const m = await tx.membresia.create({
        data: {
          socioId,
          planId,
          fechaInicio: inicio,
          fechaFin: fin,
          fechaFinAjustada: fin,
          precioLista: precio,
          descuento,
          montoTotal,
          abonoDayPassId,
          vendidaPorId: usuario.id,
          notas: descuento > 0 ? `Abono de pase diario aplicado (${formatoMoneda(descuento)})` : null,
        },
      });
      if (pagoInicial > 0 && caja) {
        await tx.pago.create({
          data: { socioId, membresiaId: m.id, cajaId: caja.id, usuarioId: usuario.id, monto: pagoInicial, metodo: metodo as never, concepto: "MEMBRESIA", referencia },
        });
      }
      if (locker !== socio.lockerNumero) await tx.socio.update({ where: { id: socioId }, data: { lockerNumero: locker } });
    });

    await sincronizarEstadoSocio(socioId);
    revalidatePath(`/socios/${socioId}`);
    revalidatePath("/socios");
    revalidatePath("/finanzas");
    const partes = [`${plan.nombre} vendido: ${formatoFecha(inicio)} → ${formatoFecha(fin)}`];
    if (descuento > 0) partes.push(`abono pase diario −${formatoMoneda(descuento)}`);
    if (montoTotal - pagoInicial > 0) partes.push(`saldo pendiente ${formatoMoneda(montoTotal - pagoInicial)}`);
    if (plan.lockerIncluido && locker) partes.push(`locker #${locker}`);
    return partes.join(" · ");
  });
}

/** Abono o pago del saldo pendiente de una membresía. */
export async function registrarAbono(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    const usuario = await requerirPermiso("registrarPago");
    const membresiaId = Number(campo(fd, "membresiaId"));
    const monto = campoNumero(fd, "monto");
    const metodo = metodoValido(campo(fd, "metodo"));
    const m = await prisma.membresia.findUnique({ where: { id: membresiaId }, include: { pagos: { select: { monto: true } }, plan: true } });
    if (!m) throw new ErrorNegocio("Membresía no encontrada.");
    const saldo = saldoPendiente(m);
    if (saldo <= 0) throw new ErrorNegocio("La membresía no tiene saldo pendiente.");
    if (!Number.isFinite(monto) || monto <= 0) throw new ErrorNegocio("Ingresa un monto válido.");
    if (monto > saldo) throw new ErrorNegocio(`El abono supera el saldo pendiente (${formatoMoneda(saldo)}).`);
    const caja = await cajaAbiertaDe(usuario.id);
    if (!caja) throw new ErrorNegocio("Debes abrir tu caja de turno antes de registrar pagos.");
    await prisma.pago.create({
      data: { socioId: m.socioId, membresiaId, cajaId: caja.id, usuarioId: usuario.id, monto, metodo, concepto: "ABONO", referencia: campo(fd, "referencia") || null },
    });
    const estado = await sincronizarEstadoSocio(m.socioId);
    revalidatePath(`/socios/${m.socioId}`);
    revalidatePath("/finanzas");
    revalidatePath("/operaciones");
    const restante = saldo - monto;
    return restante > 0
      ? `Abono de ${formatoMoneda(monto)} registrado. Saldo restante ${formatoMoneda(restante)}.`
      : `Saldo cancelado por completo${estado === "ACTIVO" ? ". El socio quedó habilitado para ingresar." : "."}`;
  });
}

export async function cancelarMembresia(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    const usuario = await requerirPermiso("venderMembresia");
    if (usuario.rol !== "ADMINISTRADOR") throw new ErrorNegocio("Solo un administrador puede anular membresías.");
    const id = Number(campo(fd, "membresiaId"));
    const m = await prisma.membresia.update({ where: { id }, data: { estado: "CANCELADA", notas: `Anulada por ${usuario.nombre}` } });
    await sincronizarEstadoSocio(m.socioId);
    revalidatePath(`/socios/${m.socioId}`);
    return "Membresía anulada";
  });
}
