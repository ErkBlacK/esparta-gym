"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requerirPermiso } from "@/lib/auth";
import { campo, campoNumero, ejecutar, ErrorNegocio, type EstadoAccion } from "@/lib/acciones";
import { ROLES } from "@/lib/constants";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function validarPassword(p: string) {
  if (p.length < 8 || !/[A-Z]/.test(p) || !/\d/.test(p)) throw new ErrorNegocio("La contraseña debe tener mínimo 8 caracteres, una mayúscula y un número.");
}

export async function crearUsuario(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    await requerirPermiso("gestionarUsuarios");
    const nombre = campo(fd, "nombre");
    const email = campo(fd, "email").toLowerCase();
    const rol = campo(fd, "rol");
    const password = campo(fd, "password");
    if (nombre.length < 3) throw new ErrorNegocio("Ingresa el nombre completo.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ErrorNegocio("Correo inválido.");
    if (!(ROLES as readonly string[]).includes(rol)) throw new ErrorNegocio("Selecciona un rol.");
    validarPassword(password);
    await prisma.usuario.create({ data: { nombre, email, rol: rol as never, passwordHash: await bcrypt.hash(password, 10) } });
    revalidatePath("/usuarios");
    return `Usuario ${email} creado`;
  });
}

export async function actualizarUsuario(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    const yo = await requerirPermiso("gestionarUsuarios");
    const id = Number(campo(fd, "id"));
    const rol = campo(fd, "rol");
    const activo = campo(fd, "activo") === "true";
    const password = campo(fd, "password");
    if (!(ROLES as readonly string[]).includes(rol)) throw new ErrorNegocio("Rol inválido.");
    if (id === yo.id && (!activo || rol !== "ADMINISTRADOR")) throw new ErrorNegocio("No puedes desactivarte ni quitarte el rol de administrador.");
    const data: Record<string, unknown> = { rol, activo };
    if (password) {
      validarPassword(password);
      data.passwordHash = await bcrypt.hash(password, 10);
    }
    await prisma.usuario.update({ where: { id }, data });
    revalidatePath("/usuarios");
    return password ? "Usuario actualizado y contraseña restablecida" : "Usuario actualizado";
  });
}

export async function actualizarPlan(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    await requerirPermiso("editarPlanes");
    const id = Number(campo(fd, "id"));
    const precio = campoNumero(fd, "precio");
    const horaInicio = campo(fd, "horaInicio");
    const horaFin = campo(fd, "horaFin");
    const dias = fd.getAll("dias").map(Number).filter((d) => d >= 1 && d <= 7).sort();
    const entero = (n: string, min = 0, max = 1000) => {
      const v = Number(campo(fd, n));
      if (!Number.isInteger(v) || v < min || v > max) throw new ErrorNegocio(`Valor inválido en ${n}.`);
      return v;
    };
    if (!Number.isFinite(precio) || precio < 0) throw new ErrorNegocio("Precio inválido.");
    if (!HHMM.test(horaInicio) || !HHMM.test(horaFin) || horaFin <= horaInicio) throw new ErrorNegocio("Revisa la franja horaria.");
    if (dias.length === 0) throw new ErrorNegocio("Selecciona al menos un día permitido.");
    await prisma.plan.update({
      where: { id },
      data: {
        nombre: campo(fd, "nombre") || undefined,
        descripcion: campo(fd, "descripcion") || undefined,
        precio,
        duracionDias: entero("duracionDias", 1, 730),
        accesosPorDia: entero("accesosPorDia", 0, 10),
        invitadosMes: entero("invitadosMes", 0, 10),
        maxDiasCongelamiento: entero("maxDiasCongelamiento", 0, 120),
        evaluacionesIncluidas: entero("evaluacionesIncluidas", 0, 24),
        horaInicio,
        horaFin,
        diasPermitidos: dias.join(","),
        activo: campo(fd, "activo") !== "false",
      },
    });
    revalidatePath("/planes");
    return "Plan actualizado. Los cambios aplican a las validaciones de acceso desde ahora.";
  });
}
