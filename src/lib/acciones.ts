import "server-only";
import { ZodError } from "zod";
import { ErrorPermiso } from "./auth";

export type EstadoAccion = { ok: boolean; mensaje: string; ts: number; data?: Record<string, unknown> } | null;

/** Error de negocio con mensaje para el usuario. */
export class ErrorNegocio extends Error {}

function esRedirect(e: unknown): boolean {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}

/**
 * Envuelve la lógica de una Server Action y devuelve un estado serializable
 * para useFormState. Los errores de negocio, permisos y validación se muestran al usuario.
 */
export async function ejecutar(fn: () => Promise<string | { mensaje: string; data?: Record<string, unknown> }>): Promise<EstadoAccion> {
  try {
    const r = await fn();
    return typeof r === "string" ? { ok: true, mensaje: r, ts: Date.now() } : { ok: true, mensaje: r.mensaje, data: r.data, ts: Date.now() };
  } catch (e) {
    if (esRedirect(e)) throw e;
    if (e instanceof ErrorNegocio || e instanceof ErrorPermiso) return { ok: false, mensaje: e.message, ts: Date.now() };
    if (e instanceof ZodError) return { ok: false, mensaje: e.issues[0]?.message ?? "Datos inválidos", ts: Date.now() };
    if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") {
      return { ok: false, mensaje: "Ya existe un registro con ese valor único (documento, correo o locker).", ts: Date.now() };
    }
    console.error(e);
    return { ok: false, mensaje: "Ocurrió un error inesperado. Intenta de nuevo.", ts: Date.now() };
  }
}

/** Lee un campo de texto del formulario (recortado). */
export function campo(fd: FormData, nombre: string): string {
  const v = fd.get(nombre);
  return typeof v === "string" ? v.trim() : "";
}

export function campoNumero(fd: FormData, nombre: string): number {
  const v = campo(fd, nombre).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
