"use server";

import { revalidatePath } from "next/cache";
import { requerirPermiso } from "@/lib/auth";
import { validarAcceso, type ResultadoValidacion } from "@/lib/servicios";

export type RespuestaKiosko = ResultadoValidacion | { error: string };

/** Valida el ingreso desde el kiosko (documento o QR). */
export async function validarIngreso(valor: string): Promise<RespuestaKiosko> {
  try {
    const usuario = await requerirPermiso("validarAcceso");
    if (!valor || valor.trim().length < 4) return { error: "Ingresa un documento o escanea un código QR." };
    const r = await validarAcceso(valor, usuario.id);
    revalidatePath("/accesos");
    return r;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No fue posible validar el ingreso." };
  }
}
