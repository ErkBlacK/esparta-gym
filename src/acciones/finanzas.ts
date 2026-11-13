"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirPermiso } from "@/lib/auth";
import { campo, campoNumero, ejecutar, ErrorNegocio, type EstadoAccion } from "@/lib/acciones";
import { cajaAbiertaDe } from "@/lib/servicios";
import { formatoMoneda, num } from "@/lib/formato";
import { TURNOS } from "@/lib/constants";

export async function abrirCaja(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    const usuario = await requerirPermiso("operarCaja");
    const turno = campo(fd, "turno");
    const montoInicial = campoNumero(fd, "montoInicial");
    if (!(TURNOS as readonly string[]).includes(turno)) throw new ErrorNegocio("Selecciona el turno.");
    if (!Number.isFinite(montoInicial) || montoInicial < 0) throw new ErrorNegocio("Monto inicial inválido.");
    const abierta = await cajaAbiertaDe(usuario.id);
    if (abierta) throw new ErrorNegocio("Ya tienes una caja abierta. Ciérrala antes de abrir otra.");
    await prisma.cajaTurno.create({ data: { usuarioId: usuario.id, turno: turno as never, montoInicial } });
    revalidatePath("/finanzas");
    return `Caja abierta con base de ${formatoMoneda(montoInicial)}`;
  });
}

/** Cierre de caja: totaliza pagos por método, compara el efectivo contado y registra la diferencia. */
export async function cerrarCaja(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    const usuario = await requerirPermiso("operarCaja");
    const cajaId = Number(campo(fd, "cajaId"));
    const contado = campoNumero(fd, "efectivoContado");
    if (!Number.isFinite(contado) || contado < 0) throw new ErrorNegocio("Ingresa el efectivo contado en caja.");
    const caja = await prisma.cajaTurno.findUnique({ where: { id: cajaId }, include: { pagos: true } });
    if (!caja || caja.estado !== "ABIERTA") throw new ErrorNegocio("La caja no está abierta.");
    if (caja.usuarioId !== usuario.id && usuario.rol === "RECEPCIONISTA") throw new ErrorNegocio("Solo puedes cerrar tu propia caja.");
    const tot = { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0 };
    for (const p of caja.pagos) tot[p.metodo] += num(p.monto);
    const esperado = num(caja.montoInicial) + tot.EFECTIVO;
    const diferencia = contado - esperado;
    await prisma.cajaTurno.update({
      where: { id: cajaId },
      data: {
        estado: "CERRADA",
        cierre: new Date(),
        totalEfectivo: tot.EFECTIVO,
        totalTarjeta: tot.TARJETA,
        totalTransferencia: tot.TRANSFERENCIA,
        efectivoContado: contado,
        diferencia,
        observaciones: campo(fd, "observaciones") || null,
      },
    });
    revalidatePath("/finanzas");
    const total = tot.EFECTIVO + tot.TARJETA + tot.TRANSFERENCIA;
    return `Caja cerrada. Recaudo del turno ${formatoMoneda(total)}. ${
      diferencia === 0 ? "Cuadre exacto." : diferencia > 0 ? `Sobrante ${formatoMoneda(diferencia)}.` : `Faltante ${formatoMoneda(-diferencia)}.`
    }`;
  });
}
