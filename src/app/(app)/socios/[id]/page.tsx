import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requerirSesion } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import { dayPassAbonable, includeMembresias, sincronizarEstadoSocio } from "@/lib/servicios";
import { evaluarEstado, inicioSugerido, saldoPendiente, totalPagado, describirDias, type MembresiaReglas } from "@/lib/reglas";
import { diferenciaDias, formatoFecha, formatoFechaHora, hoy, inicioDelDia, inicioDeMes, isoFecha } from "@/lib/fechas";
import { formatoMoneda, num } from "@/lib/formato";
import { METODO_LABEL } from "@/lib/constants";
import { actualizarSocio, asignarLocker, liberarLocker, regenerarQr, registrarEvaluacion } from "@/acciones/socios";
import { cancelarMembresia, registrarAbono, venderMembresia } from "@/acciones/membresias";
import { Avatar, Badge, Card, CardHeader, EstadoBadge, Progreso, Vacio } from "@/components/ui";
import { BotonAccion, PanelFormulario } from "@/components/forms";
import { CamposSocio, CamposVenta } from "@/components/socio-campos";
import { BotonImprimir } from "./imprimir";

export default async function SocioDetalle({ params, searchParams }: { params: { id: string }; searchParams: { nuevo?: string } }) {
  const usuario = await requerirSesion();
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();
  await sincronizarEstadoSocio(id);

  const socio = await prisma.socio.findUnique({
    where: { id },
    include: {
      ...includeMembresias,
      evaluaciones: { orderBy: { fecha: "desc" }, include: { instructor: { select: { nombre: true } } }, take: 10 },
      accesos: { orderBy: { fecha: "desc" }, take: 12 },
      invitados: { orderBy: { fecha: "desc" }, take: 10 },
      pagos: { orderBy: { fecha: "desc" }, take: 15, include: { usuario: { select: { nombre: true } }, membresia: { select: { plan: { select: { nombre: true } } } } } },
    },
  });
  if (!socio) notFound();

  const historial = await prisma.membresia.findMany({
    where: { socioId: id },
    include: { plan: true, pagos: { select: { monto: true } }, congelamientos: true, vendidaPor: { select: { nombre: true } } },
    orderBy: { fechaInicio: "desc" },
  });
  const planes = await prisma.plan.findMany({ where: { activo: true }, orderBy: { precio: "asc" } });

  const dia = hoy();
  const membresias = socio.membresias as unknown as MembresiaReglas[];
  const ev = evaluarEstado(membresias, dia);
  const vigente = ev.vigente;
  const dp = await dayPassAbonable(id);
  const abono = dp ? Math.min(num(dp.precioLista), dp.pagos.reduce((a, p) => a + num(p.monto), 0)) : 0;
  const invitadosMes = vigente ? await prisma.invitado.count({ where: { socioId: id, fecha: { gte: inicioDelDia(inicioDeMes(dia)) } } }) : 0;
  const nombre = `${socio.nombres} ${socio.apellidos}`;
  const qr = await QRCode.toDataURL(socio.qrToken, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#09090B", light: "#FFFFFF" } });

  const pendientes = historial.filter((m) => m.estado === "ACTIVA" && saldoPendiente(m) > 0);
  const duracion = vigente ? diferenciaDias(vigente.fechaInicio, vigente.fechaFinAjustada) + 1 : 0;

  const puedeGestionar = puede(usuario.rol, "gestionarSocios");
  const puedeVender = puede(usuario.rol, "venderMembresia");
  const puedePagar = puede(usuario.rol, "registrarPago");
  const puedeEvaluar = puede(usuario.rol, "evaluaciones");

  return (
    <div className="animate-fade-in">
      {searchParams.nuevo && (
        <div className="mb-5 rounded-xl bg-ok-soft px-4 py-3 text-xs text-ok ring-1 ring-inset ring-ok/20">
          Socio registrado. Su QR ya está activo; vende una membresía para habilitar el ingreso.
        </div>
      )}

      {/* Encabezado */}
      <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar nombre={nombre} foto={socio.fotoUrl} tam={64} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight">{nombre}</h1>
              <EstadoBadge estado={ev.estado} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span className="font-mono">{socio.tipoDocumento} {socio.documento}</span>
              <span>{socio.telefono}</span>
              {socio.email && <span>{socio.email}</span>}
              <span>Socio desde {formatoFecha(hoy(socio.createdAt))}</span>
            </div>
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {puedeGestionar && (
            <PanelFormulario disparador="Editar datos" varianteDisparador="secondary" titulo="Editar socio" action={actualizarSocio} textoEnviar="Guardar cambios" ancho="max-w-2xl">
              <CamposSocio
                v={{
                  ...socio,
                  fechaNacimiento: socio.fechaNacimiento ? isoFecha(socio.fechaNacimiento) : undefined,
                }}
              />
            </PanelFormulario>
          )}
          {puedeVender && (
            <PanelFormulario
              disparador={vigente ? "Renovar / vender plan" : "Vender membresía"}
              titulo="Vender membresía"
              descripcion={`${nombre} · el pago se registra en tu caja abierta`}
              action={venderMembresia}
              textoEnviar="Confirmar venta"
            >
              <CamposVenta
                socioId={id}
                planes={planes.map((p) => ({ id: p.id, nombre: p.nombre, precio: num(p.precio), tipo: p.tipo, duracionDias: p.duracionDias }))}
                abono={abono}
                sugerido={isoFecha(inicioSugerido(membresias, dia, false))}
                hoyIso={isoFecha(dia)}
              />
            </PanelFormulario>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Membresía vigente */}
        <Card className="lg:col-span-5">
          <CardHeader title="Membresía actual" description={vigente ? `${describirDias(vigente.plan.diasPermitidos)} · ${vigente.plan.horaInicio}–${vigente.plan.horaFin}` : undefined} />
          <div className="p-5 pt-4">
            {vigente ? (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-lg font-semibold tracking-tight">{vigente.plan.nombre}</div>
                    <div className="text-xs text-muted">
                      {formatoFecha(vigente.fechaInicio)} → {formatoFecha(vigente.fechaFinAjustada)}
                      {vigente.diasCongelados > 0 && <span className="ml-1.5 text-warn">(+{vigente.diasCongelados} días por congelamiento)</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-semibold tabular ${ev.diasRestantes <= 5 ? "text-warn" : "text-ok"}`}>{ev.diasRestantes}</div>
                    <div className="text-2xs text-subtle">días restantes</div>
                  </div>
                </div>
                <div className="mt-4">
                  <Progreso valor={duracion - ev.diasRestantes} max={duracion} tono={ev.diasRestantes <= 5 ? "warn" : "ok"} />
                </div>
                <dl className="mt-5 grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl bg-elevated/60 p-3">
                    <dt className="text-subtle">Invitados</dt>
                    <dd className="mt-1 font-mono text-sm">{vigente.plan.invitadosMes > 0 ? `${invitadosMes}/${vigente.plan.invitadosMes}` : "—"}</dd>
                  </div>
                  <div className="rounded-xl bg-elevated/60 p-3">
                    <dt className="text-subtle">Congelamiento</dt>
                    <dd className="mt-1 font-mono text-sm">{vigente.plan.maxDiasCongelamiento > 0 ? `${vigente.diasCongelados}/${vigente.plan.maxDiasCongelamiento} d` : "—"}</dd>
                  </div>
                  <div className="rounded-xl bg-elevated/60 p-3">
                    <dt className="text-subtle">Ingresos/día</dt>
                    <dd className="mt-1 font-mono text-sm">{vigente.plan.accesosPorDia === 0 ? "∞" : vigente.plan.accesosPorDia}</dd>
                  </div>
                </dl>
                {ev.congelamientoActual && (
                  <div className="mt-4 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn ring-1 ring-inset ring-warn/20">
                    Congelada del {formatoFecha(ev.congelamientoActual.fechaInicio)} al {formatoFecha(ev.congelamientoActual.fechaFin)}
                  </div>
                )}
                {ev.proxima && (
                  <div className="mt-4 rounded-xl bg-info-soft px-3 py-2 text-xs text-info ring-1 ring-inset ring-info/20">
                    Renovación registrada: {ev.proxima.plan.nombre} desde {formatoFecha(ev.proxima.fechaInicio)}
                  </div>
                )}
              </>
            ) : (
              <div className="py-6 text-center">
                <div className="text-[13px] font-medium">Sin membresía vigente</div>
                <div className="mt-1 text-xs text-muted">
                  {ev.proxima
                    ? `Próxima: ${ev.proxima.plan.nombre} desde ${formatoFecha(ev.proxima.fechaInicio)}`
                    : ev.ultimaVencida
                      ? `Última: ${ev.ultimaVencida.plan.nombre}, vencida el ${formatoFecha(ev.ultimaVencida.fechaFinAjustada)}`
                      : "Aún no ha comprado un plan."}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Saldos */}
        <Card className="lg:col-span-4">
          <CardHeader title="Saldo pendiente" description={ev.membresiaEnMora ? "Ingreso bloqueado hasta ponerse al día" : "Periodo de gracia: 3 días desde el inicio"} />
          <div className="p-5 pt-4">
            <div className={`text-3xl font-semibold tabular ${ev.saldoPendienteTotal > 0 ? "text-bad" : "text-fg"}`}>{formatoMoneda(ev.saldoPendienteTotal)}</div>
            <ul className="mt-4 space-y-2">
              {pendientes.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5">
                  <div className="min-w-0 text-xs">
                    <div className="font-medium">{m.plan.nombre}</div>
                    <div className="text-subtle">Pagado {formatoMoneda(totalPagado(m))} de {formatoMoneda(num(m.montoTotal))}</div>
                  </div>
                  {puedePagar && (
                    <PanelFormulario disparador="Abonar" tamDisparador="sm" varianteDisparador="secondary" titulo="Registrar abono" descripcion={`${m.plan.nombre} · saldo ${formatoMoneda(saldoPendiente(m))}`} action={registrarAbono} textoEnviar="Registrar pago">
                      <input type="hidden" name="membresiaId" value={m.id} />
                      <label className="block">
                        <span className="label">Monto</span>
                        <input name="monto" inputMode="numeric" defaultValue={saldoPendiente(m)} className="input font-mono" />
                      </label>
                      <label className="block">
                        <span className="label">Método</span>
                        <select name="metodo" className="input">
                          <option value="EFECTIVO">Efectivo</option>
                          <option value="TARJETA">Tarjeta</option>
                          <option value="TRANSFERENCIA">Transferencia</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="label">Referencia</span>
                        <input name="referencia" className="input" />
                      </label>
                    </PanelFormulario>
                  )}
                </li>
              ))}
              {pendientes.length === 0 && <li className="text-xs text-muted">Al día. No hay saldos pendientes.</li>}
            </ul>
          </div>
        </Card>

        {/* Carnet QR */}
        <Card className="lg:col-span-3" id="carnet">
          <CardHeader title="Carnet de acceso" action={<BotonImprimir />} />
          <div className="flex flex-col items-center p-5 pt-4">
            <div className="rounded-xl bg-white p-2">
              <img src={qr} alt="Código QR de acceso" width={150} height={150} />
            </div>
            <div className="mt-3 break-all text-center font-mono text-2xs text-subtle">{socio.qrToken}</div>
            <div className="mt-3 flex w-full items-center justify-between rounded-lg bg-elevated/60 px-3 py-2 text-xs">
              <span className="text-subtle">Locker</span>
              <span className="font-mono">{socio.lockerNumero ? `#${socio.lockerNumero}` : "—"}</span>
            </div>
            {puedeGestionar && (
              <div className="no-print mt-3 flex flex-wrap justify-center gap-2">
                <BotonAccion action={regenerarQr} campos={{ id }} variante="ghost" confirmar="¿Generar un QR nuevo? El carnet actual dejará de funcionar.">
                  Regenerar QR
                </BotonAccion>
                {socio.lockerNumero ? (
                  <BotonAccion action={liberarLocker} campos={{ id }} variante="ghost">Liberar locker</BotonAccion>
                ) : (
                  <PanelFormulario disparador="Asignar locker" varianteDisparador="ghost" tamDisparador="sm" titulo="Asignar locker" action={asignarLocker}>
                    <input type="hidden" name="id" value={id} />
                    <label className="block">
                      <span className="label">Número de locker</span>
                      <input name="locker" inputMode="numeric" className="input font-mono" />
                    </label>
                  </PanelFormulario>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Ficha */}
        <Card className="lg:col-span-4">
          <CardHeader title="Ficha personal" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 pt-4 text-xs">
            <div><dt className="text-subtle">Nacimiento</dt><dd className="mt-0.5">{formatoFecha(socio.fechaNacimiento)}</dd></div>
            <div><dt className="text-subtle">Género</dt><dd className="mt-0.5">{socio.genero ?? "—"}</dd></div>
            <div className="col-span-2"><dt className="text-subtle">Dirección</dt><dd className="mt-0.5">{socio.direccion ?? "—"}</dd></div>
            <div className="col-span-2 rounded-xl border border-line p-3">
              <dt className="text-subtle">Contacto de emergencia</dt>
              <dd className="mt-1 font-medium">{socio.contactoEmergenciaNombre}{socio.contactoEmergenciaParentesco && <span className="font-normal text-muted"> · {socio.contactoEmergenciaParentesco}</span>}</dd>
              <dd className="font-mono text-muted">{socio.contactoEmergenciaTelefono}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-subtle">Observaciones médicas</dt>
              <dd className={`mt-1 rounded-lg px-3 py-2 ${socio.observacionesMedicas ? "bg-warn-soft text-warn" : "bg-elevated/60 text-muted"}`}>{socio.observacionesMedicas ?? "Ninguna registrada"}</dd>
            </div>
          </dl>
        </Card>

        {/* Historial de membresías */}
        <Card className="overflow-hidden lg:col-span-8">
          <CardHeader title="Historial de membresías" description={`${historial.length} registro(s)`} />
          <div className="mt-3 overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr><th>Plan</th><th>Vigencia</th><th className="text-right">Total</th><th className="text-right">Pagado</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {historial.map((m) => {
                  const actual = vigente?.id === m.id;
                  const futura = m.fechaInicio > dia;
                  return (
                    <tr key={m.id}>
                      <td>
                        <div className="font-medium">{m.plan.nombre}</div>
                        {m.notas && <div className="text-2xs text-subtle">{m.notas}</div>}
                      </td>
                      <td className="whitespace-nowrap text-xs text-muted">{formatoFecha(m.fechaInicio)} → {formatoFecha(m.fechaFinAjustada)}{m.diasCongelados > 0 && <span className="text-warn"> +{m.diasCongelados}d</span>}</td>
                      <td className="text-right font-mono text-xs tabular">{formatoMoneda(num(m.montoTotal))}</td>
                      <td className="text-right font-mono text-xs tabular">{formatoMoneda(totalPagado(m))}</td>
                      <td>
                        {m.estado === "CANCELADA" ? <Badge>Anulada</Badge> : actual ? <Badge tono="ok">Vigente</Badge> : futura ? <Badge tono="info">Programada</Badge> : <Badge>Finalizada</Badge>}
                      </td>
                      <td className="text-right">
                        {usuario.rol === "ADMINISTRADOR" && m.estado === "ACTIVA" && m.fechaFinAjustada >= dia && (
                          <BotonAccion action={cancelarMembresia} campos={{ membresiaId: m.id }} variante="ghost" confirmar="¿Anular esta membresía? El socio perderá el acceso asociado.">
                            Anular
                          </BotonAccion>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {historial.length === 0 && <Vacio titulo="Sin membresías" />}
          </div>
        </Card>

        {/* Pagos */}
        <Card className="overflow-hidden lg:col-span-6">
          <CardHeader title="Pagos" />
          <div className="mt-3 overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Método</th><th className="text-right">Monto</th></tr></thead>
              <tbody>
                {socio.pagos.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap text-xs text-muted">{formatoFechaHora(p.fecha)}</td>
                    <td className="text-xs">{p.concepto === "ABONO" ? "Abono" : "Pago"} · {p.membresia?.plan.nombre ?? "—"}</td>
                    <td className="text-xs text-muted">{METODO_LABEL[p.metodo]}</td>
                    <td className="text-right font-mono text-xs tabular">{formatoMoneda(num(p.monto))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {socio.pagos.length === 0 && <Vacio titulo="Sin pagos registrados" />}
          </div>
        </Card>

        {/* Accesos */}
        <Card className="overflow-hidden lg:col-span-6">
          <CardHeader title="Últimos accesos" />
          <ul className="mt-3 divide-y divide-line/60">
            {socio.accesos.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${a.resultado === "PERMITIDO" ? "bg-ok" : "bg-bad"}`} />
                <span className="flex-1 truncate">{a.tipo === "INVITADO" ? a.motivo : a.resultado === "PERMITIDO" ? `Ingreso por ${a.metodo === "QR" ? "QR" : "documento"}` : a.motivo}</span>
                <span className="font-mono text-2xs text-subtle">{formatoFechaHora(a.fecha)}</span>
              </li>
            ))}
            {socio.accesos.length === 0 && <li className="px-5 py-8 text-center text-xs text-muted">Sin registros.</li>}
          </ul>
        </Card>

        {/* Evaluaciones */}
        <Card className="overflow-hidden lg:col-span-8">
          <CardHeader
            title="Evaluaciones físicas"
            description={vigente ? (vigente.plan.codigo.startsWith("ELITE") ? "Plan Elite: valoración mensual incluida" : vigente.plan.codigo === "PRO" ? "Plan Pro: 1 evaluación incluida" : "Evaluación no incluida en el plan") : undefined}
            action={
              puedeEvaluar ? (
                <PanelFormulario disparador="Nueva evaluación" tamDisparador="sm" varianteDisparador="secondary" titulo="Registrar evaluación física" descripcion={nombre} action={registrarEvaluacion}>
                  <input type="hidden" name="socioId" value={id} />
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block"><span className="label">Peso (kg) *</span><input name="pesoKg" required inputMode="decimal" className="input font-mono" /></label>
                    <label className="block"><span className="label">Estatura (cm) *</span><input name="estaturaCm" required inputMode="decimal" className="input font-mono" /></label>
                    <label className="block"><span className="label">% Grasa corporal</span><input name="grasaCorporal" inputMode="decimal" className="input font-mono" /></label>
                    <label className="block"><span className="label">Masa muscular (kg)</span><input name="masaMuscular" inputMode="decimal" className="input font-mono" /></label>
                  </div>
                  <label className="block"><span className="label">Notas y recomendaciones</span><textarea name="notas" rows={4} className="input" /></label>
                </PanelFormulario>
              ) : null
            }
          />
          <div className="mt-3 overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th className="text-right">Peso</th><th className="text-right">IMC</th><th className="text-right">% Grasa</th><th>Instructor</th><th>Notas</th></tr></thead>
              <tbody>
                {socio.evaluaciones.map((e) => {
                  const imc = num(e.pesoKg) / Math.pow(num(e.estaturaCm) / 100, 2);
                  return (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-xs text-muted">{formatoFechaHora(e.fecha)}</td>
                      <td className="whitespace-nowrap text-right font-mono text-xs">{num(e.pesoKg).toFixed(1)} kg</td>
                      <td className="text-right font-mono text-xs">{imc.toFixed(1)}</td>
                      <td className="text-right font-mono text-xs">{e.grasaCorporal ? `${num(e.grasaCorporal).toFixed(1)}%` : "—"}</td>
                      <td className="text-xs text-muted">{e.instructor?.nombre ?? "—"}</td>
                      <td className="max-w-xs truncate text-xs text-muted">{e.notas}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {socio.evaluaciones.length === 0 && <Vacio titulo="Sin evaluaciones" />}
          </div>
        </Card>

        {/* Invitados */}
        <Card className="overflow-hidden lg:col-span-4">
          <CardHeader title="Invitados" description="Pases de cortesía registrados" />
          <ul className="mt-3 divide-y divide-line/60">
            {socio.invitados.map((i) => (
              <li key={i.id} className="px-5 py-2.5 text-xs">
                <div className="flex justify-between"><span className="font-medium">{i.nombre}</span><span className="font-mono text-2xs text-subtle">{formatoFechaHora(i.fecha)}</span></div>
                <div className="font-mono text-2xs text-subtle">{i.documento}</div>
              </li>
            ))}
            {socio.invitados.length === 0 && <li className="px-5 py-8 text-center text-xs text-muted">Sin invitados.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
