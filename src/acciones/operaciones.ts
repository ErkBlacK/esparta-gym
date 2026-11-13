"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirPermiso } from "@/lib/auth";
import { campo, ejecutar, ErrorNegocio, type EstadoAccion } from "@/lib/acciones";
import { includeMembresias, sincronizarEstadoSocio } from "@/lib/servicios";
import { diasInclusivos, evaluarEstado, saldoPendiente, validarCongelamiento, type MembresiaReglas } from "@/lib/reglas";
import { GRACIA_MORA_DIAS } from "@/lib/constants";
import { diferenciaDias, formatoFecha, hoy, inicioDelDia, inicioDeMes, parseFecha, sumarDias } from "@/lib/fechas";

/**
 * Congela una membresía entre dos fechas y extiende automáticamente su vencimiento
 * en la misma cantidad de días.
 */
export async function congelarMembresia(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    const usuario = await requerirPermiso("congelar");
    const membresiaId = Number(campo(fd, "membresiaId"));
    const inicio = parseFecha(campo(fd, "fechaInicio"));
    const fin = parseFecha(campo(fd, "fechaFin"));
    const motivo = campo(fd, "motivo");
    if (!inicio || !fin) throw new ErrorNegocio("Selecciona las fechas inicial y final.");
    if (motivo.length < 3) throw new ErrorNegocio("Describe el motivo del congelamiento.");

    const m = await prisma.membresia.findUnique({
      where: { id: membresiaId },
      include: { plan: true, pagos: { select: { monto: true } }, congelamientos: true },
    });
    if (!m || m.estado !== "ACTIVA") throw new ErrorNegocio("Membresía no encontrada o anulada.");
    if (saldoPendiente(m) > 0 && diferenciaDias(m.fechaInicio, hoy()) > GRACIA_MORA_DIAS) {
      throw new ErrorNegocio("La membresía tiene saldo vencido. Registra el pago antes de congelarla.");
    }
    const error = validarCongelamiento(m as unknown as MembresiaReglas, inicio, fin, hoy());
    if (error) throw new ErrorNegocio(error);

    const dias = diasInclusivos(inicio, fin);
    const nuevaFin = sumarDias(m.fechaFinAjustada, dias);
    await prisma.$transaction([
      prisma.congelamiento.create({ data: { membresiaId, fechaInicio: inicio, fechaFin: fin, dias, motivo, creadoPorId: usuario.id } }),
      prisma.membresia.update({ where: { id: membresiaId }, data: { diasCongelados: { increment: dias }, fechaFinAjustada: nuevaFin } }),
    ]);
    await sincronizarEstadoSocio(m.socioId);
    revalidatePath("/operaciones");
    revalidatePath(`/socios/${m.socioId}`);
    return `Membresía congelada ${dias} día(s). Nuevo vencimiento: ${formatoFecha(nuevaFin)}.`;
  });
}

/** Elimina un congelamiento que aún no ha comenzado y revierte la extensión. */
export async function anularCongelamiento(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    await requerirPermiso("congelar");
    const id = Number(campo(fd, "congelamientoId"));
    const c = await prisma.congelamiento.findUnique({ where: { id }, include: { membresia: true } });
    if (!c) throw new ErrorNegocio("Congelamiento no encontrado.");
    const dia = hoy();
    if (c.fechaInicio <= dia) throw new ErrorNegocio("Solo se pueden anular congelamientos que aún no han iniciado.");
    await prisma.$transaction([
      prisma.congelamiento.delete({ where: { id } }),
      prisma.membresia.update({
        where: { id: c.membresiaId },
        data: { diasCongelados: { decrement: c.dias }, fechaFinAjustada: sumarDias(c.membresia.fechaFinAjustada, -c.dias) },
      }),
    ]);
    await sincronizarEstadoSocio(c.membresia.socioId);
    revalidatePath("/operaciones");
    revalidatePath(`/socios/${c.membresia.socioId}`);
    return "Congelamiento anulado y vencimiento restaurado.";
  });
}

/**
 * Pase de cortesía: registra al acompañante, descuenta el cupo mensual del titular
 * y deja el ingreso del invitado en la bitácora.
 */
export async function registrarInvitado(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    const usuario = await requerirPermiso("invitados");
    const documentoTitular = campo(fd, "documentoTitular");
    const nombre = campo(fd, "nombre");
    const documento = campo(fd, "documento");
    const telefono = campo(fd, "telefono") || null;
    if (nombre.length < 3) throw new ErrorNegocio("Ingresa el nombre del invitado.");
    if (documento.length < 5) throw new ErrorNegocio("Ingresa el documento del invitado.");

    const titular = await prisma.socio.findFirst({
      where: { OR: [{ documento: documentoTitular }, { id: Number(campo(fd, "socioId")) || -1 }] },
      include: includeMembresias,
    });
    if (!titular) throw new ErrorNegocio("No se encontró al socio titular.");
    if (titular.documento === documento) throw new ErrorNegocio("El invitado no puede ser el mismo titular.");
    const dia = hoy();
    const ev = evaluarEstado(titular.membresias as unknown as MembresiaReglas[], dia);
    if (ev.estado !== "ACTIVO" || !ev.vigente) throw new ErrorNegocio("El titular debe tener una membresía activa y al día para ingresar invitados.");
    const cupo = ev.vigente.plan.invitadosMes;
    if (cupo <= 0) throw new ErrorNegocio(`El ${ev.vigente.plan.nombre} no incluye invitados. Disponible en Plan Pro (1/mes) y Elite (2/mes).`);

    const usados = await prisma.invitado.count({ where: { socioId: titular.id, fecha: { gte: inicioDelDia(inicioDeMes(dia)) } } });
    if (usados >= cupo) throw new ErrorNegocio(`Cupo de invitados agotado este mes (${usados}/${cupo}).`);

    await prisma.$transaction([
      prisma.invitado.create({ data: { socioId: titular.id, membresiaId: ev.vigente.id, nombre, documento, telefono, registradoPorId: usuario.id } }),
      prisma.acceso.create({
        data: { socioId: titular.id, valorIngresado: documento, metodo: "DOCUMENTO", tipo: "INVITADO", resultado: "PERMITIDO", motivo: `Invitado: ${nombre}`, usuarioId: usuario.id },
      }),
    ]);
    revalidatePath("/operaciones");
    revalidatePath(`/socios/${titular.id}`);
    return `Ingreso de ${nombre} registrado como invitado de ${titular.nombres}. Cupos restantes este mes: ${cupo - usados - 1}.`;
  });
}
