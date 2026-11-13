import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requerirSesion } from "@/lib/auth";
import { accesosPorDia, horasPico, ingresosPorDia, ventasPorPlan } from "@/lib/metricas";
import { diferenciaDias, finDelDia, formatoFecha, formatoFechaHora, hoy, inicioDelDia, isoFecha, parseFecha, sumarDias } from "@/lib/fechas";
import { formatoMoneda } from "@/lib/formato";
import { GYM_NAME, METODO_LABEL } from "@/lib/constants";
import { Card, CardHeader, PageHeader, Stat } from "@/components/ui";
import { botonClases } from "@/components/ui-client";
import { GraficoAccesosDiarios, GraficoHoras, GraficoIngresos, GraficoPlanes } from "@/components/charts";
import { ExportarPdf } from "./exportar-pdf";

export const metadata = { title: "Reportes" };

export default async function Reportes({ searchParams }: { searchParams: { desde?: string; hasta?: string } }) {
  await requerirSesion();
  const dia = hoy();
  let hasta = parseFecha(searchParams.hasta) ?? dia;
  let desde = parseFecha(searchParams.desde) ?? sumarDias(hasta, -29);
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  if (diferenciaDias(desde, hasta) > 366) desde = sumarDias(hasta, -366);

  const [ingresos, pico, planes, accesos, nuevosSocios, ventas] = await Promise.all([
    ingresosPorDia(desde, hasta),
    horasPico(desde, hasta),
    ventasPorPlan(desde, hasta),
    accesosPorDia(desde, hasta),
    prisma.socio.count({ where: { createdAt: { gte: inicioDelDia(desde), lte: finDelDia(hasta) } } }),
    prisma.membresia.count({ where: { createdAt: { gte: inicioDelDia(desde), lte: finDelDia(hasta) }, estado: "ACTIVA" } }),
  ]);
  const totalPermitidos = accesos.serie.reduce((a, s) => a + s.permitidos, 0);
  const totalDenegados = accesos.serie.reduce((a, s) => a + s.denegados, 0);
  const dias = diferenciaDias(desde, hasta) + 1;
  const ticket = ingresos.cantidad ? ingresos.total / ingresos.cantidad : 0;
  const qs = `desde=${isoFecha(desde)}&hasta=${isoFecha(hasta)}`;
  const presets = [
    { label: "7 días", d: -6 },
    { label: "30 días", d: -29 },
    { label: "90 días", d: -89 },
  ];
  const periodo = `${formatoFecha(desde)} – ${formatoFecha(hasta)}`;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Gestión"
        title="Reportes gerenciales"
        description={`Periodo ${periodo} · ${dias} días`}
        actions={
          <ExportarPdf
            datos={{
              gym: GYM_NAME,
              periodo,
              generado: formatoFechaHora(new Date()),
              kpis: [
                ["Ingresos totales", formatoMoneda(ingresos.total)],
                ["Pagos registrados", String(ingresos.cantidad)],
                ["Ticket promedio", formatoMoneda(ticket)],
                ["Membresías vendidas", String(ventas)],
                ["Socios nuevos", String(nuevosSocios)],
                ["Accesos permitidos", String(totalPermitidos)],
                ["Accesos denegados", String(totalDenegados)],
                ["Hora pico", `${pico.pico.hora}:00 (${pico.pico.accesos} ingresos)`],
              ],
              porMetodo: (Object.keys(ingresos.porMetodo) as (keyof typeof ingresos.porMetodo)[]).map((m) => [METODO_LABEL[m], formatoMoneda(ingresos.porMetodo[m])]),
              planes: planes.map((p) => [p.plan, String(p.ventas), formatoMoneda(p.ingresos)]),
              horas: pico.serie.filter((h) => h.accesos > 0).map((h) => [`${h.hora}:00`, String(h.accesos)]),
              motivos: accesos.motivos.map((m) => [m.motivo, String(m.total)]),
              ingresosDiarios: ingresos.serie.filter((s) => s.total > 0).map((s) => [formatoFecha(new Date(s.fecha + "T00:00:00Z")), formatoMoneda(s.total)]),
            }}
          />
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
            {presets.map((p) => {
              const activo = isoFecha(hasta) === isoFecha(dia) && diferenciaDias(desde, hasta) === -p.d;
              return (
                <Link key={p.label} href={`/reportes?desde=${isoFecha(sumarDias(dia, p.d))}&hasta=${isoFecha(dia)}`} className={`inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium ${activo ? "bg-elevated text-fg ring-1 ring-line" : "text-muted hover:text-fg"}`}>
                  {p.label}
                </Link>
              );
            })}
          </div>
          <form action="/reportes" className="flex items-center gap-2">
            <input type="date" name="desde" defaultValue={isoFecha(desde)} className="input h-8 w-36" />
            <span className="text-xs text-subtle">→</span>
            <input type="date" name="hasta" defaultValue={isoFecha(hasta)} className="input h-8 w-36" />
            <button className={botonClases("secondary", "sm")}>Aplicar</button>
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-2xs uppercase tracking-wider text-subtle">CSV</span>
          {["pagos", "membresias", "accesos", "socios"].map((t) => (
            <a key={t} href={`/api/export?tipo=${t}&${qs}`} className={botonClases("secondary", "sm")}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </a>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Ingresos" value={formatoMoneda(ingresos.total)} hint={`${ingresos.cantidad} pagos`} tono="ok" />
        <Stat label="Ticket promedio" value={formatoMoneda(ticket)} hint={`${ventas} membresías vendidas`} />
        <Stat label="Accesos permitidos" value={totalPermitidos} hint={`${(totalPermitidos / dias).toFixed(1)} por día`} />
        <Stat label="Accesos denegados" value={totalDenegados} hint={`${nuevosSocios} socios nuevos`} tono={totalDenegados ? "bad" : undefined} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader title="Ingresos por día" />
          <div className="px-3 pb-4 pt-2"><GraficoIngresos datos={ingresos.serie} alto={240} /></div>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title="Recaudo por método" />
          <ul className="space-y-4 p-5">
            {(Object.keys(ingresos.porMetodo) as (keyof typeof ingresos.porMetodo)[]).map((m) => {
              const pct = ingresos.total ? (ingresos.porMetodo[m] / ingresos.total) * 100 : 0;
              return (
                <li key={m}>
                  <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted">{METODO_LABEL[m]}</span><span className="font-mono tabular">{formatoMoneda(ingresos.porMetodo[m])} <span className="text-subtle">· {pct.toFixed(0)}%</span></span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card className="lg:col-span-6">
          <CardHeader title="Membresías más vendidas" />
          <div className="px-3 pb-4 pt-3"><GraficoPlanes datos={planes} alto={220} /></div>
        </Card>
        <Card className="lg:col-span-6">
          <CardHeader title="Horas pico de asistencia" description={`Pico: ${pico.pico.hora}:00 con ${pico.pico.accesos} ingresos`} />
          <div className="px-3 pb-4 pt-2"><GraficoHoras datos={pico.serie} alto={220} /></div>
        </Card>
        <Card className="lg:col-span-8">
          <CardHeader title="Accesos por día" />
          <div className="px-3 pb-4 pt-3"><GraficoAccesosDiarios datos={accesos.serie} alto={220} /></div>
        </Card>
        <Card className="overflow-hidden lg:col-span-4">
          <CardHeader title="Motivos de denegación" />
          <table className="tabla mt-3">
            <tbody>
              {accesos.motivos.map((m) => (
                <tr key={m.motivo}><td className="text-xs">{m.motivo}</td><td className="text-right font-mono text-xs tabular">{m.total}</td></tr>
              ))}
              {accesos.motivos.length === 0 && <tr><td className="py-8 text-center text-xs text-muted">Sin denegaciones en el periodo.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
