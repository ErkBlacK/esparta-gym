import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requerirSesion } from "@/lib/auth";
import { puede, moduloDeRuta } from "@/lib/permisos";
import { sincronizarEstados, includeMembresias } from "@/lib/servicios";
import { evaluarEstado, type MembresiaReglas } from "@/lib/reglas";
import { accesosPorDia, horasPico, ingresosPorDia, ventasPorPlan } from "@/lib/metricas";
import { diaSemanaISO, finDelDia, formatoFecha, formatoHora, hoy, inicioDelDia, inicioDeMes, sumarDias } from "@/lib/fechas";
import { formatoMoneda } from "@/lib/formato";
import { ALERTA_VENCIMIENTO_DIAS, type EstadoSocioApp } from "@/lib/constants";
import { Avatar, Badge, ButtonLink, Card, CardHeader, EstadoBadge, PageHeader, Progreso, Stat } from "@/components/ui";
import { GraficoAccesosDiarios, GraficoHoras, GraficoIngresos, GraficoPlanes } from "@/components/charts";

export const metadata = { title: "Resumen" };

export default async function Dashboard({ searchParams }: { searchParams: { denegado?: string } }) {
  const usuario = await requerirSesion();
  await sincronizarEstados();
  const dia = hoy();
  const finanzas = puede(usuario.rol, "verFinanzas");

  const [porEstado, accesosHoy, ultimos, sociosVigentes, clasesHoy, ingresosHoyAgg] = await Promise.all([
    prisma.socio.groupBy({ by: ["estado"], _count: true }),
    prisma.acceso.groupBy({ by: ["resultado"], _count: true, where: { fecha: { gte: inicioDelDia(dia), lte: finDelDia(dia) } } }),
    prisma.acceso.findMany({ take: 7, orderBy: { fecha: "desc" }, include: { socio: { select: { nombres: true, apellidos: true, fotoUrl: true, id: true } } } }),
    prisma.socio.findMany({ where: { estado: "ACTIVO" }, include: includeMembresias }),
    prisma.claseGrupal.findMany({
      where: { diaSemana: diaSemanaISO(dia), activa: true },
      include: { instructor: { select: { nombre: true } }, reservas: { where: { fecha: dia, estado: { in: ["CONFIRMADA", "ASISTIO"] } }, select: { id: true } } },
      orderBy: { horaInicio: "asc" },
    }),
    prisma.pago.aggregate({ _sum: { monto: true }, where: { fecha: { gte: inicioDelDia(dia), lte: finDelDia(dia) } } }),
  ]);

  const conteo = (e: EstadoSocioApp) => porEstado.find((p) => p.estado === e)?._count ?? 0;
  const totalSocios = porEstado.reduce((a, p) => a + p._count, 0);
  const permitidosHoy = accesosHoy.find((a) => a.resultado === "PERMITIDO")?._count ?? 0;
  const denegadosHoy = accesosHoy.find((a) => a.resultado === "DENEGADO")?._count ?? 0;

  const porVencer = sociosVigentes
    .map((s) => ({ s, ev: evaluarEstado(s.membresias as unknown as MembresiaReglas[], dia) }))
    .filter(({ ev }) => ev.vigente && ev.diasRestantes <= ALERTA_VENCIMIENTO_DIAS && !ev.proxima)
    .sort((a, b) => a.ev.diasRestantes - b.ev.diasRestantes);

  const [ingresos, pico, planes, accesos14] = await Promise.all([
    finanzas ? ingresosPorDia(sumarDias(dia, -29), dia) : null,
    horasPico(sumarDias(dia, -29), dia),
    finanzas ? ventasPorPlan(sumarDias(dia, -89), dia) : null,
    accesosPorDia(sumarDias(dia, -13), dia),
  ]);
  const ingresosMes = finanzas ? await ingresosPorDia(inicioDeMes(dia), dia) : null;
  const denegadoModulo = searchParams.denegado ? moduloDeRuta(searchParams.denegado) : undefined;

  return (
    <div className="animate-fade-in">
      {denegadoModulo && (
        <div className="mb-5 rounded-xl bg-bad-soft px-4 py-3 text-xs text-bad ring-1 ring-inset ring-bad/20">
          Tu rol no tiene acceso al módulo «{denegadoModulo.label}».
        </div>
      )}
      <PageHeader
        eyebrow={`Hola, ${usuario.nombre.split(" ")[0]}`}
        title="Resumen operativo"
        description="Estado de socios, asistencia y recaudo en tiempo real."
        actions={
          puede(usuario.rol, "validarAcceso") ? (
            <>
              <ButtonLink href="/socios/nuevo" variante="secondary">Nuevo socio</ButtonLink>
              <ButtonLink href="/kiosko" variante="success">Abrir kiosko</ButtonLink>
            </>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Socios activos" value={conteo("ACTIVO")} hint={`de ${totalSocios} registrados`} tono="ok" />
        <Stat label="Ingresos hoy" value={permitidosHoy} hint={`${denegadosHoy} intento(s) denegado(s)`} />
        <Stat label="Por vencer (≤5 días)" value={porVencer.length} hint="sin renovación registrada" tono={porVencer.length ? "warn" : undefined} />
        <Stat label="Bloqueados por mora" value={conteo("BLOQUEADO_POR_MORA")} hint={`${conteo("CONGELADO")} congelado(s)`} tono={conteo("BLOQUEADO_POR_MORA") ? "bad" : undefined} />
        {finanzas ? (
          <>
            <Stat label="Recaudo hoy" value={formatoMoneda(Number(ingresosHoyAgg._sum.monto ?? 0))} className="md:col-span-2 xl:col-span-1" />
            <Stat label="Recaudo del mes" value={formatoMoneda(ingresosMes!.total)} hint={`${ingresosMes!.cantidad} pagos`} className="md:col-span-2 xl:col-span-1" />
          </>
        ) : (
          <>
            <Stat label="Clases hoy" value={clasesHoy.length} hint={`${clasesHoy.reduce((a, c) => a + c.reservas.length, 0)} reservas`} />
            <Stat label="Hora pico" value={`${pico.pico.hora}:00`} hint="últimos 30 días" />
          </>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
        {finanzas && ingresos && (
          <Card className="lg:col-span-8">
            <CardHeader title="Ingresos · últimos 30 días" description={`Total ${formatoMoneda(ingresos.total)} en ${ingresos.cantidad} pagos`} />
            <div className="px-3 pb-4 pt-2">
              <GraficoIngresos datos={ingresos.serie} />
            </div>
          </Card>
        )}
        <Card className={finanzas ? "lg:col-span-4" : "lg:col-span-7"}>
          <CardHeader title="Horas pico de asistencia" description={`Mayor afluencia a las ${pico.pico.hora}:00 · 30 días`} />
          <div className="px-3 pb-4 pt-2">
            <GraficoHoras datos={pico.serie} />
          </div>
        </Card>

        <Card className={finanzas ? "lg:col-span-5" : "lg:col-span-5"}>
          <CardHeader
            title="Próximos vencimientos"
            description={`Membresías que terminan en los próximos ${ALERTA_VENCIMIENTO_DIAS} días`}
            action={<Link href="/operaciones" className="text-xs text-muted hover:text-fg">Ver alertas →</Link>}
          />
          <ul className="mt-3 divide-y divide-line/60 pb-2">
            {porVencer.slice(0, 6).map(({ s, ev }) => (
              <li key={s.id}>
                <Link href={`/socios/${s.id}`} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-elevated/60">
                  <Avatar nombre={`${s.nombres} ${s.apellidos}`} foto={s.fotoUrl} tam={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{s.nombres} {s.apellidos}</div>
                    <div className="text-2xs text-subtle">{ev.vigente!.plan.nombre} · vence {formatoFecha(ev.vigente!.fechaFinAjustada)}</div>
                  </div>
                  <Badge tono={ev.diasRestantes <= 3 ? "bad" : "warn"}>{ev.diasRestantes === 1 ? "Hoy" : `${ev.diasRestantes} días`}</Badge>
                </Link>
              </li>
            ))}
            {porVencer.length === 0 && <li className="px-5 py-8 text-center text-xs text-muted">Sin vencimientos próximos.</li>}
          </ul>
        </Card>

        <Card className={finanzas ? "lg:col-span-7" : "lg:col-span-7"}>
          <CardHeader title="Accesos · últimos 14 días" description="Ingresos validados en torniquete" />
          <div className="px-3 pb-4 pt-3">
            <GraficoAccesosDiarios datos={accesos14.serie} alto={200} />
          </div>
        </Card>

        {finanzas && planes && (
          <Card className="lg:col-span-5">
            <CardHeader title="Membresías más vendidas" description="Últimos 90 días" />
            <div className="px-3 pb-4 pt-3">
              <GraficoPlanes datos={planes} alto={200} />
            </div>
          </Card>
        )}

        <Card className={finanzas ? "lg:col-span-4" : "lg:col-span-5"}>
          <CardHeader title="Actividad del torniquete" action={puede(usuario.rol, "validarAcceso") ? <Link href="/accesos" className="text-xs text-muted hover:text-fg">Bitácora →</Link> : null} />
          <ul className="mt-3 space-y-px pb-3">
            {ultimos.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.resultado === "PERMITIDO" ? "bg-ok" : "bg-bad"}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">
                    {a.socio ? `${a.socio.nombres} ${a.socio.apellidos}` : <span className="font-mono text-muted">{a.valorIngresado}</span>}
                    {a.tipo === "INVITADO" && <span className="ml-1.5 text-2xs text-info">invitado</span>}
                  </div>
                  <div className="truncate text-2xs text-subtle">{a.resultado === "PERMITIDO" ? a.motivo : a.motivo}</div>
                </div>
                <span className="font-mono text-2xs text-subtle">{formatoHora(a.fecha)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className={finanzas ? "lg:col-span-3" : "lg:col-span-7"}>
          <CardHeader title="Clases de hoy" action={<Link href="/clases" className="text-xs text-muted hover:text-fg">Agenda →</Link>} />
          <ul className="mt-3 space-y-3 px-5 pb-5">
            {clasesHoy.map((c) => {
              const ocup = c.reservas.length;
              return (
                <li key={c.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium">{c.nombre}</span>
                    <span className="font-mono text-2xs text-subtle">{c.horaInicio}</span>
                  </div>
                  <Progreso valor={ocup} max={c.aforoMax} tono={ocup >= c.aforoMax ? "bad" : ocup / c.aforoMax > 0.8 ? "warn" : "ok"} />
                  <div className="mt-1 text-2xs text-subtle">{ocup}/{c.aforoMax} cupos · {c.instructor?.nombre ?? "Sin instructor"}</div>
                </li>
              );
            })}
            {clasesHoy.length === 0 && <li className="py-6 text-center text-xs text-muted">No hay clases programadas hoy.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["ACTIVO", "VENCIDO", "CONGELADO", "BLOQUEADO_POR_MORA"] as EstadoSocioApp[]).map((e) => (
          <Link key={e} href={`/socios?estado=${e}`} className="card flex items-center justify-between px-4 py-3 transition hover:border-fg/20">
            <EstadoBadge estado={e} />
            <span className="font-mono text-sm tabular">{conteo(e)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
