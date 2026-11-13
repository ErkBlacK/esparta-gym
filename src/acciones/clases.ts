"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirPermiso } from "@/lib/auth";
import { campo, ejecutar, ErrorNegocio, type EstadoAccion } from "@/lib/acciones";
import { sincronizarEstadoSocio } from "@/lib/servicios";
import { diaSemanaISO, formatoFecha, hoy, parseFecha } from "@/lib/fechas";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function guardarClase(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    await requerirPermiso("gestionarClases");
    const id = Number(campo(fd, "id")) || 0;
    const nombre = campo(fd, "nombre");
    const disciplina = campo(fd, "disciplina");
    const sala = campo(fd, "sala");
    const horaInicio = campo(fd, "horaInicio");
    const horaFin = campo(fd, "horaFin");
    const aforoMax = Number(campo(fd, "aforoMax"));
    const instructorId = Number(campo(fd, "instructorId")) || null;
    const dias = fd.getAll("dias").map(Number).filter((d) => d >= 1 && d <= 7);
    if (nombre.length < 3 || !disciplina || !sala) throw new ErrorNegocio("Completa nombre, disciplina y sala.");
    if (!HHMM.test(horaInicio) || !HHMM.test(horaFin) || horaFin <= horaInicio) throw new ErrorNegocio("Revisa el horario (HH:MM, fin posterior al inicio).");
    if (!Number.isInteger(aforoMax) || aforoMax < 1 || aforoMax > 200) throw new ErrorNegocio("Aforo máximo inválido.");
    if (id) {
      await prisma.claseGrupal.update({ where: { id }, data: { nombre, disciplina, sala, horaInicio, horaFin, aforoMax, instructorId, activa: campo(fd, "activa") !== "false" } });
      revalidatePath("/clases");
      return "Clase actualizada";
    }
    if (dias.length === 0) throw new ErrorNegocio("Selecciona al menos un día de la semana.");
    await prisma.claseGrupal.createMany({ data: dias.map((diaSemana) => ({ nombre, disciplina, sala, horaInicio, horaFin, aforoMax, instructorId, diaSemana })) });
    revalidatePath("/clases");
    return `Clase creada para ${dias.length} día(s) de la semana`;
  });
}

/** Reserva con control de aforo: solo socios activos y sin cupo duplicado. */
export async function reservarClase(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    await requerirPermiso("reservar");
    const claseId = Number(campo(fd, "claseId"));
    const fecha = parseFecha(campo(fd, "fecha"));
    const documento = campo(fd, "documento");
    if (!fecha) throw new ErrorNegocio("Fecha de sesión inválida.");
    const clase = await prisma.claseGrupal.findUnique({ where: { id: claseId } });
    if (!clase || !clase.activa) throw new ErrorNegocio("Clase no disponible.");
    if (diaSemanaISO(fecha) !== clase.diaSemana) throw new ErrorNegocio("La fecha no corresponde al día de la clase.");
    if (fecha < hoy()) throw new ErrorNegocio("No se puede reservar una sesión pasada.");
    const socio = await prisma.socio.findUnique({ where: { documento } });
    if (!socio) throw new ErrorNegocio(`No existe un socio con documento ${documento}.`);
    const estado = await sincronizarEstadoSocio(socio.id);
    if (estado !== "ACTIVO") throw new ErrorNegocio(`${socio.nombres} no puede reservar: su estado es ${estado?.replace(/_/g, " ").toLowerCase()}.`);
    const ocupados = await prisma.reserva.count({ where: { claseId, fecha, estado: { in: ["CONFIRMADA", "ASISTIO"] } } });
    if (ocupados >= clase.aforoMax) throw new ErrorNegocio(`Aforo completo (${clase.aforoMax}/${clase.aforoMax}).`);
    const previa = await prisma.reserva.findUnique({ where: { claseId_socioId_fecha: { claseId, socioId: socio.id, fecha } } });
    if (previa && previa.estado !== "CANCELADA") throw new ErrorNegocio("El socio ya tiene reserva en esta sesión.");
    if (previa) await prisma.reserva.update({ where: { id: previa.id }, data: { estado: "CONFIRMADA" } });
    else await prisma.reserva.create({ data: { claseId, socioId: socio.id, fecha } });
    revalidatePath("/clases");
    return `Cupo reservado para ${socio.nombres} ${socio.apellidos} · ${clase.nombre} ${formatoFecha(fecha)} ${clase.horaInicio} (${ocupados + 1}/${clase.aforoMax})`;
  });
}

export async function cambiarEstadoReserva(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    await requerirPermiso("reservar");
    const id = Number(campo(fd, "reservaId"));
    const estado = campo(fd, "estado");
    if (!["CONFIRMADA", "CANCELADA", "ASISTIO"].includes(estado)) throw new ErrorNegocio("Estado inválido.");
    await prisma.reserva.update({ where: { id }, data: { estado: estado as never } });
    revalidatePath("/clases");
    return "Reserva actualizada";
  });
}
