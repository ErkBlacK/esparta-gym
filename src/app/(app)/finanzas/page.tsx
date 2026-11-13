import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requerirSesion } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import { cajaAbiertaDe } from "@/lib/servicios";
import { saldoPendiente } from "@/lib/reglas";
import { finDelDia, formatoFecha, formatoFechaHora, formatoHora, hoy, inicioDelDia, partesLocales } from "@/lib/fechas";
import { formatoMoneda, num } from "@/lib/formato";
import { METODO_LABEL, TURNO_LABEL } from "@/lib/constants";
import { abrirCaja, cerrarCaja } from "@/acciones/finanzas";
import { Badge, Card, CardHeader, PageHeader, Stat, Vacio } from "@/components/ui";
import { BotonEnviar, FormAccion } from "@/components/forms";

export const metadata = { title: "Caja y pagos" };

export default async function Finanzas() {
  const usuario = await requerirSesion();
  const dia = hoy();
  const caja = await cajaAbiertaDe(usuario.id);
  const pagosCaja = caja ? await prisma.pago.findMany({ where: { cajaId: caja.id }, include: { socio: true, membresia: { include: { plan: true } } }, orderBy: { fecha: "desc" } }) : [];
  const totCaja = { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0 };
  for (const p of pagosCaja) totCaja[p.metodo] += num(p.monto);

  const verTodo = puede(usuario.rol, "verFinanzas");
  const [pagosHoy, cierres, membresiasConSaldo, cajasAbiertas] = await Promise.all([
    prisma.pago.findMany({
      where: { fecha: { gte: inicioDelDia(dia), lte: finDelDia(dia) }, ...(verTodo ? {} : { usuarioId: usuario.id }) },
      include: { socio: true, membresia: { include: { plan: true } }, usuario: { select: { nombre: true } } },
      orderBy: { fecha: "desc" },
    }),
    prisma.cajaTurno.findMany({ where: { estado: "CERRADA", ...(verTodo ? {} : { usuarioId: usuario.id }) }, include: { usuario: { select: { nombre: true } } }, orderBy: { cierre: "desc" }, take: 14 }),
    prisma.membresia.findMany({ where: { estado: "ACTIVA" }, include: { pagos: { select: { monto: true } }, socio: true, plan: true } }),
    verTodo ? prisma.cajaTurno.findMany({ where: { estado: "ABIERTA" }, include: { usuario: { select: { nombre: true } }, pagos: { select: { monto: true } } } }) : Promise.resolve([]),
  ]);
  const saldos = membresiasConSaldo.map((m) => ({ m, saldo: saldoPendiente(m) })).filter((x) => x.saldo > 0).sort((a, b) => b.saldo - a.saldo);
  const totalSaldos = saldos.reduce((a, s) => a + s.saldo, 0);
  const totalHoy = pagosHoy.reduce((a, p) => a + num(p.monto), 0);
  const h = partesLocales().h;
  const turnoSugerido = h < 13 ? "MANANA" : h < 21 ? "TARDE" : "NOCHE";

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Gestión" title="Caja y pagos" description="Apertura y cierre de caja por turno, recaudo por método y cartera pendiente." />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          {caja ? (
            <>
              <CardHeader
                title={<span className="flex items-center gap-2">Mi caja · turno {TURNO_LABEL[caja.turno].toLowerCase()} <Badge tono="ok">Abierta</Badge></span>}
                description={`Abierta ${formatoFechaHora(caja.apertura)} · base ${formatoMoneda(num(caja.montoInicial))}`}
              />
              <div className="grid grid-cols-3 gap-2 p-5 pt-4">
                {(["EFECTIVO", "TARJETA", "TRANSFERENCIA"] as const).map((m) => (
                  <div key={m} className="rounded-xl bg-elevated/60 p-3">
                    <div className="text-2xs text-subtle">{METODO_LABEL[m]}</div>
                    <div className="mt-1 font-mono text-sm tabular">{formatoMoneda(totCaja[m])}</div>
                  </div>
                ))}
              </div>
              <FormAccion action={cerrarCaja} className="space-y-3 border-t border-line p-5">
                <input type="hidden" name="cajaId" value={caja.id} />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Efectivo esperado en caja</span>
                  <span className="font-mono tabular">{formatoMoneda(num(caja.montoInicial) + totCaja.EFECTIVO)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block"><span className="label">Efectivo contado</span><input name="efectivoContado" required inputMode="numeric" className="input font-mono" /></label>
                  <label className="block"><span className="label">Observaciones</span><input name="observaciones" className="input" /></label>
                </div>
                <div className="flex justify-end"><BotonEnviar variante="danger" confirmar="¿Cerrar la caja del turno? No podrás registrar más pagos en ella.">Cerrar caja</BotonEnviar></div>
              </FormAccion>
            </>
          ) : (
            <>
              <CardHeader title="Mi caja" description="Abre tu caja para registrar ventas y abonos." />
              <FormAccion action={abrirCaja} className="space-y-3 p-5 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="label">Turno</span>
                    <select name="turno" defaultValue={turnoSugerido} className="input">
                      <option value="MANANA">Mañana</option>
                      <option value="TARDE">Tarde</option>
                      <option value="NOCHE">Noche</option>
                    </select>
                  </label>
                  <label className="block"><span className="label">Base inicial (efectivo)</span><input name="montoInicial" defaultValue="200000" inputMode="numeric" className="input font-mono" /></label>
                </div>
                <div className="flex justify-end"><BotonEnviar variante="success">Abrir caja</BotonEnviar></div>
              </FormAccion>
            </>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:col-span-7">
          <Stat label={verTodo ? "Recaudo de hoy (todas las cajas)" : "Mi recaudo de hoy"} value={formatoMoneda(totalHoy)} hint={`${pagosHoy.length} pagos`} tono="ok" />
          <Stat label="Cartera pendiente" value={formatoMoneda(totalSaldos)} hint={`${saldos.length} membresía(s) con saldo`} tono={totalSaldos > 0 ? "bad" : undefined} />
          {verTodo ? (
            <Card className="col-span-2 p-5">
              <div className="text-xs text-muted">Cajas abiertas ahora</div>
              <ul className="mt-3 space-y-2">
                {cajasAbiertas.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-xs">
                    <span>{c.usuario.nombre} · {TURNO_LABEL[c.turno]}</span>
                    <span className="font-mono tabular">{formatoMoneda(c.pagos.reduce((a, p) => a + num(p.monto), 0))}</span>
                  </li>
                ))}
                {cajasAbiertas.length === 0 && <li className="text-xs text-subtle">No hay cajas abiertas.</li>}
              </ul>
            </Card>
          ) : (
            <Card className="col-span-2 p-5 text-xs text-muted">
              Registra ventas y abonos desde el perfil de cada socio. Los pagos quedan asociados a tu caja abierta y se totalizan al cerrar el turno.
            </Card>
          )}
        </div>

        <Card className="overflow-hidden lg:col-span-7">
          <CardHeader title="Pagos de hoy" />
          <div className="mt-3 overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Hora</th><th>Socio</th><th>Concepto</th><th>Método</th>{verTodo && <th>Cajero</th>}<th className="text-right">Monto</th></tr></thead>
              <tbody>
                {pagosHoy.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs text-muted">{formatoHora(p.fecha)}</td>
                    <td><Link href={`/socios/${p.socioId}`} className="font-medium">{p.socio.nombres} {p.socio.apellidos}</Link></td>
                    <td className="text-xs text-muted">{p.concepto === "ABONO" ? "Abono" : "Venta"} · {p.membresia?.plan.nombre}</td>
                    <td className="text-xs text-muted">{METODO_LABEL[p.metodo]}</td>
                    {verTodo && <td className="text-xs text-subtle">{p.usuario?.nombre}</td>}
                    <td className="text-right font-mono text-xs tabular">{formatoMoneda(num(p.monto))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pagosHoy.length === 0 && <Vacio titulo="Sin pagos hoy" />}
          </div>
        </Card>

        <Card className="overflow-hidden lg:col-span-5">
          <CardHeader title="Cartera pendiente" description="Membresías con saldo por cobrar" />
          <ul className="mt-3 max-h-[420px] divide-y divide-line/60 overflow-y-auto">
            {saldos.map(({ m, saldo }) => (
              <li key={m.id}>
                <Link href={`/socios/${m.socioId}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-elevated/60">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{m.socio.nombres} {m.socio.apellidos}</div>
                    <div className="text-2xs text-subtle">{m.plan.nombre} · desde {formatoFecha(m.fechaInicio)}</div>
                  </div>
                  <span className="font-mono text-xs text-bad tabular">{formatoMoneda(saldo)}</span>
                </Link>
              </li>
            ))}
            {saldos.length === 0 && <li className="px-5 py-8 text-center text-xs text-muted">Sin cartera pendiente.</li>}
          </ul>
        </Card>

        <Card className="overflow-hidden lg:col-span-12">
          <CardHeader title="Cierres de caja" description="Arqueo por turno: totales por método y diferencia contra el efectivo esperado" />
          <div className="mt-3 overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Cierre</th><th>Cajero</th><th>Turno</th><th className="text-right">Efectivo</th><th className="text-right">Tarjeta</th><th className="text-right">Transferencia</th><th className="text-right">Total</th><th className="text-right">Diferencia</th></tr></thead>
              <tbody>
                {cierres.map((c) => {
                  const total = num(c.totalEfectivo) + num(c.totalTarjeta) + num(c.totalTransferencia);
                  const dif = num(c.diferencia);
                  return (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap font-mono text-xs text-muted">{formatoFechaHora(c.cierre)}</td>
                      <td className="text-xs">{c.usuario.nombre}</td>
                      <td className="text-xs text-muted">{TURNO_LABEL[c.turno]}</td>
                      <td className="text-right font-mono text-xs tabular">{formatoMoneda(num(c.totalEfectivo))}</td>
                      <td className="text-right font-mono text-xs tabular">{formatoMoneda(num(c.totalTarjeta))}</td>
                      <td className="text-right font-mono text-xs tabular">{formatoMoneda(num(c.totalTransferencia))}</td>
                      <td className="text-right font-mono text-xs font-medium tabular">{formatoMoneda(total)}</td>
                      <td className="text-right">{dif === 0 ? <Badge tono="ok" punto={false}>Cuadrada</Badge> : <Badge tono={dif > 0 ? "warn" : "bad"} punto={false}>{dif > 0 ? "+" : "−"}{formatoMoneda(Math.abs(dif))}</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {cierres.length === 0 && <Vacio titulo="Sin cierres registrados" />}
          </div>
        </Card>
      </div>
    </div>
  );
}
