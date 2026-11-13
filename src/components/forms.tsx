"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import { botonClases } from "./ui-client";
import { cn } from "@/lib/formato";

export type EstadoAccion = { ok: boolean; mensaje: string; ts: number; data?: Record<string, unknown> } | null;
export type AccionServidor = (estado: EstadoAccion, fd: FormData) => Promise<EstadoAccion>;

export function BotonEnviar({
  children,
  variante = "primary",
  tam = "md",
  className,
  confirmar,
}: {
  children: ReactNode;
  variante?: "primary" | "secondary" | "ghost" | "danger" | "success";
  tam?: "sm" | "md" | "lg";
  className?: string;
  confirmar?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(botonClases(variante, tam), className)}
      onClick={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {pending && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function MensajeAccion({ estado }: { estado: EstadoAccion }) {
  if (!estado) return null;
  return (
    <div
      key={estado.ts}
      role="status"
      className={cn(
        "animate-fade-in rounded-lg px-3 py-2 text-xs ring-1 ring-inset",
        estado.ok ? "bg-ok-soft text-ok ring-ok/20" : "bg-bad-soft text-bad ring-bad/20",
      )}
    >
      {estado.mensaje}
    </div>
  );
}

/** Formulario conectado a una Server Action con mensaje de resultado. */
export function FormAccion({
  action,
  children,
  className,
  reiniciar = true,
  alExito,
  mostrarMensaje = true,
}: {
  action: AccionServidor;
  children: ReactNode;
  className?: string;
  reiniciar?: boolean;
  alExito?: (estado: NonNullable<EstadoAccion>) => void;
  mostrarMensaje?: boolean;
}) {
  const [estado, formAction] = useFormState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const alExitoRef = useRef(alExito);
  alExitoRef.current = alExito;
  useEffect(() => {
    if (estado?.ok) {
      if (reiniciar) ref.current?.reset();
      alExitoRef.current?.(estado);
    }
  }, [estado, reiniciar]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {mostrarMensaje && estado && (
        <div className="mt-3">
          <MensajeAccion estado={estado} />
        </div>
      )}
    </form>
  );
}

/** Botón que abre un panel lateral con un formulario; se cierra al completar. */
export function PanelFormulario({
  disparador,
  titulo,
  descripcion,
  action,
  children,
  textoEnviar = "Guardar",
  varianteDisparador = "primary",
  tamDisparador = "md",
  ancho = "max-w-lg",
}: {
  disparador: ReactNode;
  titulo: string;
  descripcion?: string;
  action: AccionServidor;
  children: ReactNode;
  textoEnviar?: string;
  varianteDisparador?: "primary" | "secondary" | "ghost" | "danger" | "success";
  tamDisparador?: "sm" | "md" | "lg";
  ancho?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [ultimo, setUltimo] = useState<EstadoAccion>(null);
  useEffect(() => setMontado(true), []);
  useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [abierto]);

  return (
    <>
      <button type="button" className={botonClases(varianteDisparador, tamDisparador)} onClick={() => setAbierto(true)}>
        {disparador}
      </button>
      {ultimo?.ok && !abierto && (
        <span key={ultimo.ts} className="sr-only" role="status">
          {ultimo.mensaje}
        </span>
      )}
      {montado &&
        abierto &&
        createPortal(
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-[2px]" onClick={() => setAbierto(false)} />
            <div className={cn("relative flex h-full w-full animate-fade-in flex-col border-l border-line bg-surface shadow-pop", ancho)}>
              <div className="flex items-start justify-between border-b border-line px-6 py-5">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight">{titulo}</h2>
                  {descripcion && <p className="mt-1 text-xs text-muted">{descripcion}</p>}
                </div>
                <button type="button" onClick={() => setAbierto(false)} className="kbd hover:text-fg" aria-label="Cerrar">
                  esc
                </button>
              </div>
              <FormAccion
                action={action}
                className="flex min-h-0 flex-1 flex-col"
                alExito={(e) => {
                  setUltimo(e);
                  setAbierto(false);
                }}
              >
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">{children}</div>
                <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
                  <button type="button" className={botonClases("ghost")} onClick={() => setAbierto(false)}>
                    Cancelar
                  </button>
                  <BotonEnviar>{textoEnviar}</BotonEnviar>
                </div>
              </FormAccion>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Botón de acción inmediata (p. ej. cancelar, marcar asistencia) con campos ocultos. */
export function BotonAccion({
  action,
  campos,
  children,
  variante = "secondary",
  tam = "sm",
  confirmar,
}: {
  action: AccionServidor;
  campos: Record<string, string | number>;
  children: ReactNode;
  variante?: "primary" | "secondary" | "ghost" | "danger" | "success";
  tam?: "sm" | "md" | "lg";
  confirmar?: string;
}) {
  const [estado, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v)} />
      ))}
      <BotonEnviar variante={variante} tam={tam} confirmar={confirmar}>
        {children}
      </BotonEnviar>
      {estado && !estado.ok && <span className="max-w-[220px] text-right text-2xs text-bad">{estado.mensaje}</span>}
    </form>
  );
}
