"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requerirPermiso } from "@/lib/auth";
import { campo, ejecutar, ErrorNegocio, type EstadoAccion } from "@/lib/acciones";
import { generarQrToken, sincronizarEstadoSocio } from "@/lib/servicios";
import { parseFecha } from "@/lib/fechas";

const esquemaSocio = z.object({
  tipoDocumento: z.enum(["CC", "TI", "CE", "PASAPORTE"], { message: "Tipo de documento inválido" }),
  documento: z.string().regex(/^[A-Za-z0-9-]{5,20}$/, "El documento debe tener entre 5 y 20 caracteres alfanuméricos"),
  nombres: z.string().min(2, "Ingresa los nombres").max(80),
  apellidos: z.string().min(2, "Ingresa los apellidos").max(80),
  telefono: z.string().min(7, "Teléfono inválido").max(30),
  email: z.union([z.literal(""), z.string().email("Correo inválido")]),
  direccion: z.string().max(200),
  genero: z.string().max(20),
  contactoEmergenciaNombre: z.string().min(3, "Ingresa el contacto de emergencia").max(120),
  contactoEmergenciaTelefono: z.string().min(7, "Teléfono de emergencia inválido").max(30),
  contactoEmergenciaParentesco: z.string().max(40),
  observacionesMedicas: z.string().max(2000),
});

function leerSocio(fd: FormData) {
  const datos = esquemaSocio.parse({
    tipoDocumento: campo(fd, "tipoDocumento") || "CC",
    documento: campo(fd, "documento"),
    nombres: campo(fd, "nombres"),
    apellidos: campo(fd, "apellidos"),
    telefono: campo(fd, "telefono"),
    email: campo(fd, "email"),
    direccion: campo(fd, "direccion"),
    genero: campo(fd, "genero"),
    contactoEmergenciaNombre: campo(fd, "contactoEmergenciaNombre"),
    contactoEmergenciaTelefono: campo(fd, "contactoEmergenciaTelefono"),
    contactoEmergenciaParentesco: campo(fd, "contactoEmergenciaParentesco"),
    observacionesMedicas: campo(fd, "observacionesMedicas"),
  });
  const foto = campo(fd, "fotoUrl");
  if (foto && !foto.startsWith("data:image/")) throw new ErrorNegocio("Formato de fotografía inválido.");
  if (foto.length > 1_500_000) throw new ErrorNegocio("La fotografía es demasiado pesada.");
  const nacimiento = campo(fd, "fechaNacimiento");
  return {
    ...datos,
    email: datos.email || null,
    direccion: datos.direccion || null,
    genero: datos.genero || null,
    contactoEmergenciaParentesco: datos.contactoEmergenciaParentesco || null,
    observacionesMedicas: datos.observacionesMedicas || null,
    fechaNacimiento: parseFecha(nacimiento),
    fotoUrl: foto || undefined,
  };
}

export async function crearSocio(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  let id = 0;
  const r = await ejecutar(async () => {
    await requerirPermiso("gestionarSocios");
    const datos = leerSocio(fd);
    const existe = await prisma.socio.findUnique({ where: { documento: datos.documento } });
    if (existe) throw new ErrorNegocio(`Ya existe un socio con el documento ${datos.documento}.`);
    const socio = await prisma.socio.create({ data: { ...datos, fotoUrl: datos.fotoUrl ?? null, qrToken: generarQrToken(), estado: "VENCIDO" } });
    id = socio.id;
    return "Socio registrado";
  });
  if (r?.ok && id) {
    revalidatePath("/socios");
    redirect(`/socios/${id}?nuevo=1`);
  }
  return r;
}

export async function actualizarSocio(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    await requerirPermiso("gestionarSocios");
    const id = Number(campo(fd, "id"));
    const datos = leerSocio(fd);
    const otro = await prisma.socio.findFirst({ where: { documento: datos.documento, NOT: { id } } });
    if (otro) throw new ErrorNegocio(`El documento ${datos.documento} pertenece a otro socio.`);
    await prisma.socio.update({ where: { id }, data: datos });
    revalidatePath(`/socios/${id}`);
    revalidatePath("/socios");
    return "Datos actualizados";
  });
}

export async function regenerarQr(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    await requerirPermiso("gestionarSocios");
    const id = Number(campo(fd, "id"));
    await prisma.socio.update({ where: { id }, data: { qrToken: generarQrToken() } });
    revalidatePath(`/socios/${id}`);
    return "Se generó un nuevo código QR. El carnet anterior quedó inválido.";
  });
}

export async function liberarLocker(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    await requerirPermiso("gestionarSocios");
    const id = Number(campo(fd, "id"));
    await prisma.socio.update({ where: { id }, data: { lockerNumero: null } });
    revalidatePath(`/socios/${id}`);
    return "Locker liberado";
  });
}

export async function asignarLocker(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    await requerirPermiso("gestionarSocios");
    const id = Number(campo(fd, "id"));
    const numero = Number(campo(fd, "locker"));
    if (!Number.isInteger(numero) || numero < 1) throw new ErrorNegocio("Número de locker inválido.");
    const ocupado = await prisma.socio.findFirst({ where: { lockerNumero: numero, NOT: { id } } });
    if (ocupado) throw new ErrorNegocio(`El locker ${numero} ya está asignado a ${ocupado.nombres} ${ocupado.apellidos}.`);
    await prisma.socio.update({ where: { id }, data: { lockerNumero: numero } });
    revalidatePath(`/socios/${id}`);
    return `Locker ${numero} asignado`;
  });
}

export async function registrarEvaluacion(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return ejecutar(async () => {
    const usuario = await requerirPermiso("evaluaciones");
    const socioId = Number(campo(fd, "socioId"));
    const peso = Number(campo(fd, "pesoKg").replace(",", "."));
    const estatura = Number(campo(fd, "estaturaCm").replace(",", "."));
    const grasa = campo(fd, "grasaCorporal");
    const masa = campo(fd, "masaMuscular");
    if (!(peso > 20 && peso < 300)) throw new ErrorNegocio("Peso inválido (kg).");
    if (!(estatura > 100 && estatura < 250)) throw new ErrorNegocio("Estatura inválida (cm).");
    await prisma.evaluacionFisica.create({
      data: {
        socioId,
        instructorId: usuario.id,
        pesoKg: peso,
        estaturaCm: estatura,
        grasaCorporal: grasa ? Number(grasa.replace(",", ".")) : null,
        masaMuscular: masa ? Number(masa.replace(",", ".")) : null,
        notas: campo(fd, "notas") || null,
      },
    });
    revalidatePath(`/socios/${socioId}`);
    return "Evaluación registrada";
  });
}

export async function refrescarEstado(socioId: number) {
  await sincronizarEstadoSocio(socioId);
}
