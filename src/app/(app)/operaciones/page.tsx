import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requerirSesion } from "@/lib/auth";
import { includeMembresias, sincronizarEstados } from "@/lib/servicios";
import { evaluarEstado, type MembresiaReglas } from "@/lib/reglas";
import { formatoFecha, formatoFechaHora, hoy, inicioDelDia, inicioDeMes, isoFecha, sumarDias } from "@/lib/fechas";
import { formatoMoneda } from "@/lib/formato";
import { ALERTA_VENCIMIENTO_DIAS, GRACIA_MORA_DIAS } from "@/lib/constants";
import { anularCongelamiento, congelarMembresia, registrarInvitado } from "@/acciones/operaciones";
import { Avatar, Badge, Card, CardHeader, EstadoBadge, PageHeader, Vacio } from "@/components/ui";
import { BotonAccion, BotonEnviar, FormAccion } from "@/components/forms";

export const metadata = { title: "Congelamientos e invitados" };

export default async function Operaciones() {
  await requerirSesion();
  await sincronizarEstados();
  const dia = hoy();

  const socios = await prisma.socio.findMany({ include: includeMembresias, orderBy: { apellidos: "asc" } });
  const evaluados = socios.map((s) => ({ s, ev: evaluarEstado(s.membresias as unknown as MembresiaReglas[], dia) }));

  const porVencer = evaluados
    .filter(({ ev }) => ev.vigente && ev.diasRestantes <= ALERTA_VENCIMIENTO_DIAS)
    .sort((a, b) => a.ev.diasRestantes - b.ev.diasRestantes);
  const morosos = evaluados.filter(({ ev }) => ev.saldoPendienteTotal > 0).sort((a, b) => b.ev.saldoPendienteTotal - a.ev.saldoPendienteTotal);
  const congelables = evaluados.filter(({ ev }) => ev.vigente && ev.vigente.plan.maxDiasCongelamiento > 0 && !ev.membresiaEnMora);

  const [congelamientos, invitados] = await Promise.all([
    prisma.congelamiento.findMany({
      where: { fechaFin: { gte: sumarDias(dia, -7) } },
      include: { membresia: { include: { socio: true, plan: true } }, creadoPor: { select: { nombre: true } } },
      orderBy: { fechaInicio: "asc" },
    }),
    prisma.invitado.findMany({
      where: { fecha: { gte: inicioDelDia(inicioDeMes(dia)) } },
      include: { socio: true, membresia: { include: { plan: true } } },
      orderBy: { fecha: "desc" },
    }),
  ]);

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Operación" title="Congelamientos, invitados y alertas" description="Pausa membresías extendiendo su vencimiento, registra pases de cortesía y anticípate a vencimientos y mora." />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Card className="lg:col-span-6">
          <CardHeader title="Congelar membresía" description="Disponible en planes Elite · hasta 30 días por membresía" />
          <FormAccion action={congelarMembresia} className="space-y-3 p-5 pt-4">
            <label className="block">
              <span className="label">Socio y membresía</span>
              <select name="membresiaId" required className="input" defaultValue="">
                <option value="" disabled>Selecciona un socio con plan Elite vigente</option>
                {congelables.map(({ s, ev }) => (
                  <option key={ev.vigente!.id} value={ev.vigente!.id}>
                    {s.nombres} {s.apellidos} · {ev.vigente!.plan.nombre} · {ev.vigente!.plan.maxDiasCongelamiento - ev.vigente!.diasCongelados} días disponibles
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">Desde</span><input type="date" name="fechaInicio" required min={isoFecha(dia)} defaultValue={isoFecha(dia)} className="input" /></label>
              <label className="block"><span className="label">Hasta</span><input type="date" name="fechaFin" required min={isoFecha(dia)} defaultValue={isoFecha(sumarDias(dia, 6))} className="input" /></label>
            </div>
            <label className="block"><span className="label">Motivo</span><input name="motivo" required className="input" placeholder="Viaje, incapacidad médica, vacaciones…" /></label>
            <div className="flex items-center justify-between pt-1">
              <span className="text-2xs text-subtle">El vencimiento se extiende automáticamente por los días congelados.</span>
              <BotonEnviar variante="secondary">Congelar</BotonEnviar>
            </div>
          </FormAccion>
        </Card>

        <Card className="lg:col-span-6">
          <CardHeader title="Pase de cortesía" description="Plan Pro: 1 invitado/mes · Plan Elite: 2 invitados/mes" />
          <FormAccion action={registrarInvitado} className="space-y-3 p-5 pt-4">
            <label className="block"><span className="label">Documento del socio titular</span><input name="documentoTitular" required className="input font-mono" placeholder="1010101010" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">Nombre del invitado</span><input name="nombre" required className="input" /></label>
              <label className="block"><span className="label">Documento del invitado</span><input name="documento" required className="input font-mono" /></label>
            </div>
            <label className="block"><span className="label">Teléfono (opcional)</span><input name="telefono" className="input" /></label>
            <div className="flex items-center justify-between pt-1">
              <span className="text-2xs text-subtle">Descuenta el cupo mensual y registra el ingreso en la bitácora.</span>
              <BotonEnviar variante="success">Registrar ingreso</BotonEnviar>
            </div>
          </FormAccion>
        </Card>

        <Card className="overflow-hidden lg:col-span-7">
          <CardHeader title="Alertas de vencimiento" description={`Membresías que terminan en los próximos ${ALERTA_VENCIMIENTO_DIAS} días`} action={<Badge tono={porVencer.length ? "warn" : "neutral"}>{porVencer.length}</Badge>} />
          <div className="mt-3 overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Socio</th><th>Plan</th><th>Vence</th><th>Contacto</th><th></th></tr></thead>
              <tbody>
                {porVencer.map(({ s, ev }) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/socios/${s.id}`} className="flex items-center gap-2.5">
                        <Avatar nombre={`${s.nombres} ${s.apellidos}`} foto={s.fotoUrl} tam={26} />
                        <span className="font-medium">{s.nombres} {s.apellidos}</span>
                      </Link>
                    </td>
                    <td className="text-xs text-muted">{ev.vigente!.plan.nombre}</td>
                    <td className="whitespace-nowrap">
                      <Badge tono={ev.diasRestantes <= 3 ? "bad" : "warn"}>{ev.diasRestantes === 1 ? "Hoy" : `En ${ev.diasRestantes} días`}</Badge>
                      <span className="ml-2 text-2xs text-subtle">{formatoFecha(ev.vigente!.fechaFinAjustada)}</span>
                    </td>
                    <td className="font-mono text-xs text-muted">{s.telefono}</td>
                    <td className="text-right">
                      {ev.proxima ? <Badge tono="info">Renovado</Badge> : <Link href={`/socios/${s.id}`} className="text-xs text-ok hover:underline">Renovar →</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {porVencer.length === 0 && <Vacio titulo="Sin vencimientos próximos" />}
          </div>
        </Card>

        <Card className="overflow-hidden lg:col-span-5">
          <CardHeader title="Mora y saldos pendientes" description={`Bloqueo automático pasados ${GRACIA_MORA_DIAS} días del inicio`} />
          <ul className="mt-3 divide-y divide-line/60">
            {morosos.map(({ s, ev }) => (
              <li key={s.id}>
                <Link href={`/socios/${s.id}`} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-elevated/60">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{s.nombres} {s.apellidos}</div>
                    <div className="text-2xs text-subtle">{(ev.membresiaEnMora ?? ev.vigente)?.plan.nombre}</div>
                  </div>
                  <span className="font-mono text-xs text-bad tabular">{formatoMoneda(ev.saldoPendienteTotal)}</span>
                  <EstadoBadge estado={ev.estado} />
                </Link>
              </li>
            ))}
            {morosos.length === 0 && <li className="px-5 py-8 text-center text-xs text-muted">No hay saldos pendientes.</li>}
          </ul>
        </Card>

        <Card className="overflow-hidden lg:col-span-7">
          <CardHeader title="Congelamientos" description="Activos, programados y finalizados en la última semana" />
          <div className="mt-3 overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Socio</th><th>Periodo</th><th>Días</th><th>Motivo</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {congelamientos.map((c) => {
                  const estado = c.fechaInicio > dia ? "Programado" : c.fechaFin < dia ? "Finalizado" : "Activo";
                  return (
                    <tr key={c.id}>
                      <td><Link href={`/socios/${c.membresia.socioId}`} className="font-medium">{c.membresia.socio.nombres} {c.membresia.socio.apellidos}</Link></td>
                      <td className="whitespace-nowrap text-xs text-muted">{formatoFecha(c.fechaInicio)} → {formatoFecha(c.fechaFin)}</td>
                      <td className="font-mono text-xs">{c.dias}</td>
                      <td className="max-w-[180px] truncate text-xs text-muted">{c.motivo}</td>
                      <td><Badge tono={estado === "Activo" ? "warn" : estado === "Programado" ? "info" : "neutral"}>{estado}</Badge></td>
                      <td className="text-right">
                        {estado === "Programado" && (
                          <BotonAccion action={anularCongelamiento} campos={{ congelamientoId: c.id }} variante="ghost" confirmar="¿Anular este congelamiento programado?">Anular</BotonAccion>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {congelamientos.length === 0 && <Vacio titulo="Sin congelamientos recientes" />}
          </div>
        </Card>

        <Card className="overflow-hidden lg:col-span-5">
          <CardHeader title="Invitados este mes" action={<Badge>{invitados.length}</Badge>} />
          <ul className="mt-3 divide-y divide-line/60">
            {invitados.map((i) => (
              <li key={i.id} className="px-5 py-2.5 text-xs">
                <div className="flex justify-between gap-2"><span className="font-medium">{i.nombre}</span><span className="font-mono text-2xs text-subtle">{formatoFechaHora(i.fecha)}</span></div>
                <div className="text-subtle">Invitado de {i.socio.nombres} {i.socio.apellidos} · {i.membresia.plan.nombre}</div>
              </li>
            ))}
            {invitados.length === 0 && <li className="px-5 py-8 text-center text-xs text-muted">Sin invitados registrados este mes.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
