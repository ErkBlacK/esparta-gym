import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";
import { finDelDia, formatoFecha, formatoFechaHora, hoy, inicioDelDia, parseFecha, sumarDias } from "@/lib/fechas";
import { num } from "@/lib/formato";
import { saldoPendiente } from "@/lib/reglas";

export const dynamic = "force-dynamic";

function csv(filas: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + filas.map((f) => f.map(esc).join(";")).join("\r\n");
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !puede(session.user.rol, "exportar")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const tipo = sp.get("tipo") ?? "pagos";
  const hasta = parseFecha(sp.get("hasta")) ?? hoy();
  const desde = parseFecha(sp.get("desde")) ?? sumarDias(hasta, -29);
  const rango = { gte: inicioDelDia(desde), lte: finDelDia(hasta) };
  let filas: (string | number | null)[][] = [];

  if (tipo === "pagos") {
    const pagos = await prisma.pago.findMany({ where: { fecha: rango }, include: { socio: true, membresia: { include: { plan: true } }, usuario: true }, orderBy: { fecha: "asc" } });
    filas = [["ID", "Fecha", "Documento", "Socio", "Plan", "Concepto", "Método", "Monto", "Referencia", "Cajero"]];
    for (const p of pagos) filas.push([p.id, formatoFechaHora(p.fecha), p.socio.documento, `${p.socio.nombres} ${p.socio.apellidos}`, p.membresia?.plan.nombre ?? "", p.concepto, p.metodo, num(p.monto), p.referencia, p.usuario?.nombre ?? ""]);
  } else if (tipo === "accesos") {
    const accesos = await prisma.acceso.findMany({ where: { fecha: rango }, include: { socio: true, usuario: true }, orderBy: { fecha: "asc" } });
    filas = [["ID", "Fecha", "Documento", "Socio", "Tipo", "Método", "Resultado", "Motivo", "Operador"]];
    for (const a of accesos) filas.push([a.id, formatoFechaHora(a.fecha), a.socio?.documento ?? a.valorIngresado, a.socio ? `${a.socio.nombres} ${a.socio.apellidos}` : "", a.tipo, a.metodo, a.resultado, a.motivo, a.usuario?.nombre ?? ""]);
  } else if (tipo === "membresias") {
    const ms = await prisma.membresia.findMany({ where: { createdAt: rango }, include: { socio: true, plan: true, pagos: { select: { monto: true } }, vendidaPor: true }, orderBy: { createdAt: "asc" } });
    filas = [["ID", "Venta", "Documento", "Socio", "Plan", "Inicio", "Fin ajustada", "Precio lista", "Descuento", "Total", "Saldo", "Estado", "Vendedor"]];
    for (const m of ms) filas.push([m.id, formatoFechaHora(m.createdAt), m.socio.documento, `${m.socio.nombres} ${m.socio.apellidos}`, m.plan.nombre, formatoFecha(m.fechaInicio), formatoFecha(m.fechaFinAjustada), num(m.precioLista), num(m.descuento), num(m.montoTotal), saldoPendiente(m), m.estado, m.vendidaPor?.nombre ?? ""]);
  } else if (tipo === "socios") {
    const socios = await prisma.socio.findMany({ orderBy: { apellidos: "asc" } });
    filas = [["ID", "Tipo doc", "Documento", "Nombres", "Apellidos", "Teléfono", "Correo", "Estado", "Locker", "Contacto emergencia", "Tel. emergencia", "Registro"]];
    for (const s of socios) filas.push([s.id, s.tipoDocumento, s.documento, s.nombres, s.apellidos, s.telefono, s.email, s.estado, s.lockerNumero, s.contactoEmergenciaNombre, s.contactoEmergenciaTelefono, formatoFechaHora(s.createdAt)]);
  } else {
    return NextResponse.json({ error: "Tipo de reporte desconocido" }, { status: 400 });
  }

  const nombre = `${tipo}_${desde.toISOString().slice(0, 10)}_${hasta.toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv(filas), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nombre}"` },
  });
}
