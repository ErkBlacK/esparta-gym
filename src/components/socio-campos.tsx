"use client";

import { useRef, useState } from "react";
import { cn, iniciales } from "@/lib/formato";

export type SocioValores = {
  id?: number;
  tipoDocumento?: string;
  documento?: string;
  nombres?: string;
  apellidos?: string;
  fechaNacimiento?: string;
  genero?: string | null;
  email?: string | null;
  telefono?: string;
  direccion?: string | null;
  fotoUrl?: string | null;
  contactoEmergenciaNombre?: string;
  contactoEmergenciaTelefono?: string;
  contactoEmergenciaParentesco?: string | null;
  observacionesMedicas?: string | null;
};

/** Reduce la foto a 320px JPEG en el navegador para guardarla como data URL. */
async function procesarFoto(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo);
  const img = new Image();
  await new Promise((ok, err) => {
    img.onload = ok;
    img.onerror = err;
    img.src = url;
  });
  const lado = 320;
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d")!;
  const min = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, lado, lado);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 font-mono text-2xs uppercase tracking-[0.16em] text-subtle">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function C({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function CamposSocio({ v = {} }: { v?: SocioValores }) {
  const [foto, setFoto] = useState<string>(v.fotoUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nombre = `${v.nombres ?? ""} ${v.apellidos ?? ""}`.trim() || "Socio";

  return (
    <div className="space-y-6">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <input type="hidden" name="fotoUrl" value={foto} />

      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-elevated ring-1 ring-line">
          {foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xl text-muted">{iniciales(nombre)}</div>}
        </div>
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="h-8 rounded-md border border-line px-3 text-xs hover:bg-elevated">
              {foto ? "Cambiar fotografía" : "Subir o tomar fotografía"}
            </button>
            {foto && (
              <button type="button" onClick={() => setFoto("")} className="h-8 rounded-md px-3 text-xs text-muted hover:text-bad">
                Quitar
              </button>
            )}
          </div>
          <p className="text-2xs text-subtle">JPG o PNG. Se recorta en cuadrado y se optimiza automáticamente.</p>
          {error && <p className="text-2xs text-bad">{error}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setError(null);
                setFoto(await procesarFoto(f));
              } catch {
                setError("No se pudo leer la imagen.");
              }
            }}
          />
        </div>
      </div>

      <Seccion titulo="Identificación">
        <div className="grid grid-cols-3 gap-3">
          <C label="Tipo">
            <select name="tipoDocumento" defaultValue={v.tipoDocumento ?? "CC"} className="input">
              <option value="CC">CC</option>
              <option value="TI">TI</option>
              <option value="CE">CE</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </C>
          <C label="Número de documento *" className="col-span-2">
            <input name="documento" required defaultValue={v.documento} className="input font-mono" placeholder="1012345678" />
          </C>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <C label="Nombres *">
            <input name="nombres" required defaultValue={v.nombres} className="input" />
          </C>
          <C label="Apellidos *">
            <input name="apellidos" required defaultValue={v.apellidos} className="input" />
          </C>
          <C label="Fecha de nacimiento">
            <input name="fechaNacimiento" type="date" defaultValue={v.fechaNacimiento} className="input" />
          </C>
          <C label="Género">
            <select name="genero" defaultValue={v.genero ?? ""} className="input">
              <option value="">Sin especificar</option>
              <option>Femenino</option>
              <option>Masculino</option>
              <option>Otro</option>
            </select>
          </C>
        </div>
      </Seccion>

      <Seccion titulo="Contacto">
        <div className="grid grid-cols-2 gap-3">
          <C label="Teléfono *">
            <input name="telefono" required defaultValue={v.telefono} className="input" inputMode="tel" />
          </C>
          <C label="Correo">
            <input name="email" type="email" defaultValue={v.email ?? ""} className="input" />
          </C>
          <C label="Dirección" className="col-span-2">
            <input name="direccion" defaultValue={v.direccion ?? ""} className="input" />
          </C>
        </div>
      </Seccion>

      <Seccion titulo="Contacto de emergencia">
        <div className="grid grid-cols-2 gap-3">
          <C label="Nombre *">
            <input name="contactoEmergenciaNombre" required defaultValue={v.contactoEmergenciaNombre} className="input" />
          </C>
          <C label="Teléfono *">
            <input name="contactoEmergenciaTelefono" required defaultValue={v.contactoEmergenciaTelefono} className="input" inputMode="tel" />
          </C>
          <C label="Parentesco">
            <input name="contactoEmergenciaParentesco" defaultValue={v.contactoEmergenciaParentesco ?? ""} className="input" placeholder="Madre, pareja…" />
          </C>
        </div>
      </Seccion>

      <Seccion titulo="Salud">
        <C label="Observaciones médicas">
          <textarea name="observacionesMedicas" rows={3} defaultValue={v.observacionesMedicas ?? ""} className="input" placeholder="Lesiones, condiciones o restricciones a tener en cuenta por los instructores." />
        </C>
      </Seccion>
    </div>
  );
}

export type PlanVenta = { id: number; nombre: string; precio: number; tipo: string; duracionDias: number };

export function CamposVenta({ socioId, planes, abono, sugerido, hoyIso }: { socioId: number; planes: PlanVenta[]; abono: number; sugerido: string; hoyIso: string }) {
  const [planId, setPlanId] = useState(planes.find((p) => p.tipo !== "DIARIO")?.id ?? planes[0]?.id ?? 0);
  const plan = planes.find((p) => p.id === planId);
  const esDiario = plan?.tipo === "DIARIO";
  const [aplicar, setAplicar] = useState(true);
  const descuento = !esDiario && aplicar ? Math.min(abono, plan?.precio ?? 0) : 0;
  const total = Math.max(0, (plan?.precio ?? 0) - descuento);
  const [pago, setPago] = useState<string>(String(total));
  const [inicio, setInicio] = useState(esDiario ? hoyIso : sugerido);
  const fmt = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-4">
      <input type="hidden" name="socioId" value={socioId} />
      <input type="hidden" name="aplicarAbono" value={aplicar ? "si" : "no"} />
      <div className="grid gap-2">
        {planes.map((p) => (
          <label key={p.id} className={cn("flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition", p.id === planId ? "border-ok/50 bg-ok-soft" : "border-line hover:bg-elevated")}>
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="planId"
                value={p.id}
                checked={p.id === planId}
                onChange={() => {
                  setPlanId(p.id);
                  const d = p.tipo !== "DIARIO" && aplicar ? Math.min(abono, p.precio) : 0;
                  setPago(String(p.precio - d));
                  setInicio(p.tipo === "DIARIO" ? hoyIso : sugerido);
                }}
                className="accent-[#10B981]"
              />
              <span>
                <span className="block text-[13px] font-medium">{p.nombre}</span>
                <span className="block text-2xs text-subtle">{p.duracionDias} día(s)</span>
              </span>
            </span>
            <span className="font-mono text-[13px] tabular">{fmt(p.precio)}</span>
          </label>
        ))}
      </div>

      {abono > 0 && !esDiario && (
        <label className="flex items-start gap-3 rounded-xl border border-ok/30 bg-ok-soft px-4 py-3 text-xs">
          <input type="checkbox" checked={aplicar} onChange={(e) => { setAplicar(e.target.checked); const d = e.target.checked ? Math.min(abono, plan?.precio ?? 0) : 0; setPago(String((plan?.precio ?? 0) - d)); }} className="mt-0.5 accent-[#10B981]" />
          <span>
            <span className="font-medium text-ok">Pase diario abonable · {fmt(abono)}</span>
            <span className="block text-muted">Compró un pase diario hace menos de 48 horas. Su valor se descuenta de esta membresía.</span>
          </span>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Fecha de inicio</span>
          <input type="date" name="fechaInicio" value={inicio} min={hoyIso} onChange={(e) => setInicio(e.target.value)} className="input" />
          {!esDiario && sugerido !== hoyIso && <span className="mt-1 block text-2xs text-warn">Renovación: inicia al terminar la vigente</span>}
        </label>
        <label className="block">
          <span className="label">Pago inicial</span>
          <input name="pagoInicial" inputMode="numeric" value={pago} onChange={(e) => setPago(e.target.value.replace(/[^\d]/g, ""))} className="input font-mono" />
          <span className="mt-1 block text-2xs text-subtle">{esDiario ? "El pase diario se paga completo" : "Puede ser parcial (abono)"}</span>
        </label>
        <label className="block">
          <span className="label">Método de pago</span>
          <select name="metodo" className="input" defaultValue="EFECTIVO">
            <option value="EFECTIVO">Efectivo</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="TRANSFERENCIA">Transferencia</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Referencia</span>
          <input name="referencia" className="input" placeholder="Voucher / # transacción" />
        </label>
      </div>

      <div className="rounded-xl border border-line bg-elevated/50 p-4 text-xs">
        <div className="flex justify-between text-muted"><span>Precio de lista</span><span className="font-mono tabular">{fmt(plan?.precio ?? 0)}</span></div>
        {descuento > 0 && <div className="mt-1 flex justify-between text-ok"><span>Abono pase diario</span><span className="font-mono tabular">−{fmt(descuento)}</span></div>}
        <div className="mt-2 flex justify-between border-t border-line pt-2 text-[13px] font-medium"><span>Total</span><span className="font-mono tabular">{fmt(total)}</span></div>
        <div className="mt-1 flex justify-between text-muted"><span>Saldo pendiente</span><span className={cn("font-mono tabular", total - Number(pago || 0) > 0 && "text-warn")}>{fmt(Math.max(0, total - Number(pago || 0)))}</span></div>
      </div>
    </div>
  );
}
