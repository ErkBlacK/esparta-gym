import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requerirSesion } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import { diaSemanaISO, formatoFecha, hoy, isoFecha, parseFecha, sumarDias } from "@/lib/fechas";
import { DIAS_SEMANA } from "@/lib/constants";
import { cambiarEstadoReserva, guardarClase, reservarClase } from "@/acciones/clases";
import { Avatar, Badge, Card, CardHeader, PageHeader, Progreso, Vacio } from "@/components/ui";
import { BotonAccion, BotonEnviar, FormAccion, PanelFormulario } from "@/components/forms";
import { cn } from "@/lib/formato";

export const metadata = { title: "Clases y reservas" };

function proximaFecha(diaSemana: number, desde: Date) {
  return sumarDias(desde, (diaSemana - diaSemanaISO(desde) + 7) % 7);
}

export default async function Clases({ searchParams }: { searchParams: { clase?: string; fecha?: string; mias?: string } }) {
  const usuario = await requerirSesion();
  const dia = hoy();
  const soloMias = usuario.rol === "INSTRUCTOR" && searchParams.mias !== "0";
  const [clases, instructores] = await Promise.all([
    prisma.claseGrupal.findMany({
      where: soloMias ? { instructorId: usuario.id } : {},
      include: { instructor: { select: { id: true, nombre: true } } },
      orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
    }),
    prisma.usuario.findMany({ where: { rol: "INSTRUCTOR", activo: true }, select: { id: true, nombre: true } }),
  ]);

  // Ocupación de la próxima sesión de cada clase
  const proximas = clases.map((c) => ({ c, fecha: proximaFecha(c.diaSemana, dia) }));
  const ocupacion = await prisma.reserva.groupBy({
    by: ["claseId", "fecha"],
    _count: true,
    where: { claseId: { in: clases.map((c) => c.id) }, fecha: { gte: dia, lte: sumarDias(dia, 6) }, estado: { in: ["CONFIRMADA", "ASISTIO"] } },
  });
  const ocup = (claseId: number, fecha: Date) => ocupacion.find((o) => o.claseId === claseId && isoFecha(o.fecha) === isoFecha(fecha))?._count ?? 0;

  const seleccion = clases.find((c) => c.id === Number(searchParams.clase));
  const fechaSel = seleccion ? (parseFecha(searchParams.fecha) ?? proximaFecha(seleccion.diaSemana, dia)) : null;
  const reservas =
    seleccion && fechaSel
      ? await prisma.reserva.findMany({ where: { claseId: seleccion.id, fecha: fechaSel }, include: { socio: true }, orderBy: [{ estado: "asc" }, { createdAt: "asc" }] })
      : [];
  const ocupadosSel = reservas.filter((r) => r.estado !== "CANCELADA").length;
  const fechasOpc = seleccion ? Array.from({ length: 4 }, (_, i) => sumarDias(proximaFecha(seleccion.diaSemana, dia), i * 7)) : [];
  if (seleccion && fechaSel && fechaSel < dia) fechasOpc.unshift(fechaSel);
  const anteriorSel = seleccion ? sumarDias(proximaFecha(seleccion.diaSemana, dia), -7) : null;

  const diaHoy = diaSemanaISO(dia);
  const gestionar = puede(usuario.rol, "gestionarClases");

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Operación"
        title="Clases grupales y reservas"
        description="Agenda semanal con control de aforo máximo por sesión."
        actions={
          <>
            {usuario.rol === "INSTRUCTOR" && (
              <Link href={soloMias ? "/clases?mias=0" : "/clases"} className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-xs text-muted hover:text-fg">
                {soloMias ? "Ver todas las clases" : "Ver solo mis clases"}
              </Link>
            )}
            {gestionar && (
              <PanelFormulario disparador="Nueva clase" titulo="Programar clase" action={guardarClase} textoEnviar="Crear clase">
                <div className="grid grid-cols-2 gap-3">
                  <label className="col-span-2 block"><span className="label">Nombre</span><input name="nombre" required className="input" placeholder="Spinning Amanecer" /></label>
                  <label className="block">
                    <span className="label">Disciplina</span>
                    <select name="disciplina" className="input"><option>Spinning</option><option>Yoga</option><option>Crossfit</option><option>Pilates</option><option>Funcional</option><option>Baile</option></select>
                  </label>
                  <label className="block"><span className="label">Sala</span><input name="sala" required className="input" placeholder="Sala Ciclo" /></label>
                  <label className="block"><span className="label">Inicio</span><input name="horaInicio" type="time" required className="input font-mono" /></label>
                  <label className="block"><span className="label">Fin</span><input name="horaFin" type="time" required className="input font-mono" /></label>
                  <label className="block"><span className="label">Aforo máximo</span><input name="aforoMax" defaultValue={15} inputMode="numeric" className="input font-mono" /></label>
                  <label className="block">
                    <span className="label">Instructor</span>
                    <select name="instructorId" className="input"><option value="">Sin asignar</option>{instructores.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select>
                  </label>
                </div>
                <div>
                  <span className="label">Días de la semana</span>
                  <div className="flex flex-wrap gap-1.5">
                    {DIAS_SEMANA.map((d, i) => (
                      <label key={d} className="flex h-8 cursor-pointer items-center rounded-lg border border-line px-2.5 text-xs has-[:checked]:border-ok/50 has-[:checked]:bg-ok-soft has-[:checked]:text-ok">
                        <input type="checkbox" name="dias" value={i + 1} className="sr-only" />
                        {d.slice(0, 3)}
                      </label>
                    ))}
                  </div>
                </div>
              </PanelFormulario>
            )}
          </>
        }
      />

      <div className={cn("grid grid-cols-1 gap-3", seleccion && "xl:grid-cols-[1fr_400px]")}>
        <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4", seleccion ? "2xl:grid-cols-7" : "xl:grid-cols-7")}>
          {DIAS_SEMANA.map((nombreDia, idx) => {
            const d = idx + 1;
            const delDia = proximas.filter((p) => p.c.diaSemana === d);
            return (
              <div key={nombreDia} className={cn("min-h-[200px] rounded-2xl border border-line p-2", d === diaHoy ? "bg-surface ring-1 ring-ok/30" : "bg-surface/40")}>
                <div className="flex items-center justify-between gap-2 px-1.5 pb-2 pt-1">
                  <span className={cn("text-xs font-medium", d === diaHoy ? "text-ok" : "text-muted")}>{nombreDia}</span>
                  <span className="font-mono text-2xs text-subtle">{formatoFecha(proximaFecha(d, dia)).slice(0, 5)}</span>
                </div>
                <div className="space-y-1.5">
                  {delDia.map(({ c, fecha }) => {
                    const n = ocup(c.id, fecha);
                    const lleno = n >= c.aforoMax;
                    return (
                      <Link
                        key={c.id}
                        href={`/clases?clase=${c.id}${searchParams.mias ? `&mias=${searchParams.mias}` : ""}`}
                        className={cn(
                          "block rounded-xl border p-2.5 transition hover:border-fg/20",
                          seleccion?.id === c.id ? "border-ok/50 bg-ok-soft" : "border-line bg-bg",
                          !c.activa && "opacity-50",
                        )}
                      >
                        <div className="whitespace-nowrap font-mono text-2xs text-subtle">{c.horaInicio}–{c.horaFin}</div>
                        <div className="mt-0.5 text-[13px] font-medium leading-tight">{c.nombre}</div>
                        <div className="mt-0.5 truncate text-2xs text-subtle">{c.instructor?.nombre ?? "Sin instructor"} · {c.sala}</div>
                        <div className="mt-2"><Progreso valor={n} max={c.aforoMax} tono={lleno ? "bad" : n / c.aforoMax > 0.8 ? "warn" : "ok"} /></div>
                        <div className={cn("mt-1 text-2xs", lleno ? "text-bad" : "text-muted")}>{lleno ? "Aforo completo" : `${n}/${c.aforoMax} cupos`}</div>
                      </Link>
                    );
                  })}
                  {delDia.length === 0 && <div className="px-1.5 py-4 text-center text-2xs text-subtle">—</div>}
                </div>
              </div>
            );
          })}
        </div>

        {seleccion && fechaSel && (
          <Card className="h-fit overflow-hidden xl:sticky xl:top-20">
            <CardHeader
              title={seleccion.nombre}
              description={`${DIAS_SEMANA[seleccion.diaSemana - 1]} ${seleccion.horaInicio}–${seleccion.horaFin} · ${seleccion.sala} · ${seleccion.instructor?.nombre ?? "Sin instructor"}`}
              action={<Link href="/clases" className="kbd hover:text-fg">×</Link>}
            />
            <div className="flex flex-wrap gap-1 px-5 pt-4">
              {anteriorSel && (
                <Link href={`/clases?clase=${seleccion.id}&fecha=${isoFecha(anteriorSel)}`} className={cn("rounded-md px-2 py-1 font-mono text-2xs", isoFecha(anteriorSel) === isoFecha(fechaSel) ? "bg-elevated text-fg ring-1 ring-line" : "text-subtle hover:text-fg")}>
                  ← {formatoFecha(anteriorSel).slice(0, 5)}
                </Link>
              )}
              {fechasOpc.filter((f) => f >= dia).map((f) => (
                <Link key={isoFecha(f)} href={`/clases?clase=${seleccion.id}&fecha=${isoFecha(f)}`} className={cn("rounded-md px-2 py-1 font-mono text-2xs", isoFecha(f) === isoFecha(fechaSel) ? "bg-elevated text-fg ring-1 ring-line" : "text-muted hover:text-fg")}>
                  {formatoFecha(f).slice(0, 5)}
                </Link>
              ))}
            </div>
            <div className="px-5 pt-4">
              <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted">Ocupación {formatoFecha(fechaSel)}</span><span className="font-mono">{ocupadosSel}/{seleccion.aforoMax}</span></div>
              <Progreso valor={ocupadosSel} max={seleccion.aforoMax} tono={ocupadosSel >= seleccion.aforoMax ? "bad" : "ok"} />
            </div>
            {fechaSel >= dia && seleccion.activa && (
              <FormAccion action={reservarClase} className="px-5 pt-4">
                <input type="hidden" name="claseId" value={seleccion.id} />
                <input type="hidden" name="fecha" value={isoFecha(fechaSel)} />
                <div className="flex gap-2">
                  <input name="documento" required placeholder="Documento del socio" className="input font-mono" />
                  <BotonEnviar variante="success">Reservar</BotonEnviar>
                </div>
              </FormAccion>
            )}
            <ul className="mt-4 divide-y divide-line/60 border-t border-line">
              {reservas.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Avatar nombre={`${r.socio.nombres} ${r.socio.apellidos}`} foto={r.socio.fotoUrl} tam={26} />
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-[13px]", r.estado === "CANCELADA" && "text-subtle line-through")}>{r.socio.nombres} {r.socio.apellidos}</div>
                    <div className="font-mono text-2xs text-subtle">{r.socio.documento}</div>
                  </div>
                  {r.estado === "ASISTIO" && <Badge tono="ok">Asistió</Badge>}
                  {r.estado === "CANCELADA" && <Badge>Cancelada</Badge>}
                  {r.estado === "CONFIRMADA" && (
                    <div className="flex gap-1">
                      {fechaSel <= dia && <BotonAccion action={cambiarEstadoReserva} campos={{ reservaId: r.id, estado: "ASISTIO" }} variante="ghost">Asistió</BotonAccion>}
                      <BotonAccion action={cambiarEstadoReserva} campos={{ reservaId: r.id, estado: "CANCELADA" }} variante="ghost">Cancelar</BotonAccion>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {reservas.length === 0 && <Vacio titulo="Sin reservas para esta sesión" />}
          </Card>
        )}
      </div>
    </div>
  );
}
