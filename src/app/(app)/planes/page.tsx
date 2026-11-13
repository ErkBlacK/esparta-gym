import { prisma } from "@/lib/prisma";
import { requerirSesion } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import { describirDias } from "@/lib/reglas";
import { hoy } from "@/lib/fechas";
import { formatoMoneda, num } from "@/lib/formato";
import { DIAS_CORTOS } from "@/lib/constants";
import { actualizarPlan } from "@/acciones/admin";
import { Badge, Card, PageHeader } from "@/components/ui";
import { PanelFormulario } from "@/components/forms";

export const metadata = { title: "Planes" };

const TIPO: Record<string, string> = { MENSUAL: "Mensual", TRIMESTRAL: "Trimestral", SEMESTRAL: "Semestral", ANUAL: "Anual", DIARIO: "Diario" };

export default async function Planes() {
  const usuario = await requerirSesion();
  const dia = hoy();
  const planes = await prisma.plan.findMany({ orderBy: { precio: "asc" } });
  const vigentes = await prisma.membresia.groupBy({ by: ["planId"], _count: true, where: { estado: "ACTIVA", fechaInicio: { lte: dia }, fechaFinAjustada: { gte: dia } } });
  const editar = puede(usuario.rol, "editarPlanes");

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Gestión" title="Planes y membresías" description="Catálogo comercial y reglas que aplica el kiosko: horarios, límite de ingresos, invitados y congelamiento." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {planes.map((p, i) => {
          const beneficios = [
            p.accesosPorDia === 0 ? "Ingresos ilimitados por día" : `${p.accesosPorDia} ingreso${p.accesosPorDia > 1 ? "s" : ""} por día`,
            p.tipo === "DIARIO" ? "Abono del valor si compra plan en 48 h" : "Musculación y cardio",
            p.evaluacionesIncluidas > 0 && `${p.evaluacionesIncluidas} evaluación física incluida`,
            p.valoracionMensual && "Valoración física mensual",
            p.invitadosMes > 0 && `${p.invitadosMes} invitado${p.invitadosMes > 1 ? "s" : ""} al mes`,
            p.lockerIncluido && "Locker asignado",
            p.maxDiasCongelamiento > 0 && `Congelamiento hasta ${p.maxDiasCongelamiento} días`,
            p.accesoPreferencial && "Acceso preferencial (horario extendido)",
          ].filter(Boolean) as string[];
          const destacado = p.codigo === "PRO";
          return (
            <Card key={p.id} className={`relative flex flex-col p-6 ${destacado ? "ring-1 ring-ok/40" : ""} ${i === planes.length - 1 && planes.length % 3 === 1 ? "xl:col-span-1" : ""}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-2xs uppercase tracking-[0.16em] text-subtle">{TIPO[p.tipo]} · {p.duracionDias} días</div>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">{p.nombre}</h3>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {!p.activo && <Badge tono="bad">Inactivo</Badge>}
                  {destacado && <Badge tono="ok" punto={false}>Más vendido</Badge>}
                </div>
              </div>
              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight tabular">{formatoMoneda(num(p.precio))}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">{p.descripcion}</p>
              <ul className="mt-5 space-y-2 border-t border-line pt-4 text-[13px]">
                {beneficios.map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <span className="mt-[7px] h-1 w-3 shrink-0 rounded-full bg-ok/70" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-elevated/60 p-3">
                  <div className="text-subtle">Horario</div>
                  <div className="mt-1 font-mono">{p.horaInicio}–{p.horaFin}</div>
                  <div className="text-2xs text-subtle">{describirDias(p.diasPermitidos)}</div>
                </div>
                <div className="rounded-xl bg-elevated/60 p-3">
                  <div className="text-subtle">Socios vigentes</div>
                  <div className="mt-1 font-mono text-lg">{vigentes.find((v) => v.planId === p.id)?._count ?? 0}</div>
                </div>
              </div>
              {editar && (
                <div className="mt-5 flex justify-end">
                  <PanelFormulario disparador="Editar reglas" varianteDisparador="secondary" tamDisparador="sm" titulo={`Editar ${p.nombre}`} descripcion="Los cambios aplican a nuevas ventas y a las validaciones del kiosko." action={actualizarPlan}>
                    <input type="hidden" name="id" value={p.id} />
                    <label className="block"><span className="label">Nombre</span><input name="nombre" defaultValue={p.nombre} className="input" /></label>
                    <label className="block"><span className="label">Descripción</span><textarea name="descripcion" defaultValue={p.descripcion} rows={3} className="input" /></label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block"><span className="label">Precio (COP)</span><input name="precio" defaultValue={num(p.precio)} inputMode="numeric" className="input font-mono" /></label>
                      <label className="block"><span className="label">Duración (días)</span><input name="duracionDias" defaultValue={p.duracionDias} inputMode="numeric" className="input font-mono" /></label>
                      <label className="block"><span className="label">Hora inicio</span><input name="horaInicio" type="time" defaultValue={p.horaInicio} className="input font-mono" /></label>
                      <label className="block"><span className="label">Hora fin</span><input name="horaFin" type="time" defaultValue={p.horaFin} className="input font-mono" /></label>
                      <label className="block"><span className="label">Ingresos por día (0 = ilimitado)</span><input name="accesosPorDia" defaultValue={p.accesosPorDia} inputMode="numeric" className="input font-mono" /></label>
                      <label className="block"><span className="label">Invitados al mes</span><input name="invitadosMes" defaultValue={p.invitadosMes} inputMode="numeric" className="input font-mono" /></label>
                      <label className="block"><span className="label">Días máx. congelamiento</span><input name="maxDiasCongelamiento" defaultValue={p.maxDiasCongelamiento} inputMode="numeric" className="input font-mono" /></label>
                      <label className="block"><span className="label">Evaluaciones incluidas</span><input name="evaluacionesIncluidas" defaultValue={p.evaluacionesIncluidas} inputMode="numeric" className="input font-mono" /></label>
                    </div>
                    <div>
                      <span className="label">Días permitidos</span>
                      <div className="flex gap-1.5">
                        {DIAS_CORTOS.map((d, idx) => (
                          <label key={d} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-line text-xs has-[:checked]:border-ok/50 has-[:checked]:bg-ok-soft has-[:checked]:text-ok">
                            <input type="checkbox" name="dias" value={idx + 1} defaultChecked={p.diasPermitidos.split(",").includes(String(idx + 1))} className="sr-only" />
                            {d}
                          </label>
                        ))}
                      </div>
                    </div>
                    <label className="block">
                      <span className="label">Estado</span>
                      <select name="activo" defaultValue={String(p.activo)} className="input"><option value="true">Activo (disponible para venta)</option><option value="false">Inactivo</option></select>
                    </label>
                  </PanelFormulario>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
