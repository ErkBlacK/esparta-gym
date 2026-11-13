import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requerirSesion } from "@/lib/auth";
import { finDelDia, formatoFechaHora, hoy, inicioDelDia, sumarDias } from "@/lib/fechas";
import { Avatar, Badge, ButtonLink, Card, Filtros, PageHeader, Vacio } from "@/components/ui";

export const metadata = { title: "Bitácora de accesos" };

const RANGOS: Record<string, number> = { hoy: 0, "7d": 6, "30d": 29 };

export default async function Accesos({ searchParams }: { searchParams: { resultado?: string; rango?: string; q?: string; tipo?: string } }) {
  await requerirSesion();
  const dia = hoy();
  const rango = searchParams.rango && searchParams.rango in RANGOS ? searchParams.rango : "hoy";
  const resultado = searchParams.resultado === "PERMITIDO" || searchParams.resultado === "DENEGADO" ? searchParams.resultado : undefined;
  const tipo = searchParams.tipo === "INVITADO" ? ("INVITADO" as const) : undefined;
  const q = (searchParams.q ?? "").trim();
  const desde = sumarDias(dia, -RANGOS[rango]!);
  const whereBase = {
    fecha: { gte: inicioDelDia(desde), lte: finDelDia(dia) },
    ...(tipo ? { tipo } : {}),
    ...(q ? { OR: [{ valorIngresado: { contains: q } }, { socio: { nombres: { contains: q } } }, { socio: { apellidos: { contains: q } } }, { socio: { documento: { contains: q } } }] } : {}),
  };
  const [accesos, conteo] = await Promise.all([
    prisma.acceso.findMany({
      where: { ...whereBase, ...(resultado ? { resultado } : {}) },
      include: { socio: { select: { id: true, nombres: true, apellidos: true, fotoUrl: true, documento: true } }, usuario: { select: { nombre: true } } },
      orderBy: { fecha: "desc" },
      take: 400,
    }),
    prisma.acceso.groupBy({ by: ["resultado"], _count: true, where: whereBase }),
  ]);
  const n = (r: string) => conteo.find((c) => c.resultado === r)?._count ?? 0;
  const params = new URLSearchParams();
  if (rango !== "hoy") params.set("rango", rango);
  if (q) params.set("q", q);
  if (tipo) params.set("tipo", tipo);
  const baseResultado = `/accesos${params.toString() ? "?" + params.toString() : ""}`;
  const paramsR = new URLSearchParams(params);
  paramsR.delete("rango");
  if (resultado) paramsR.set("resultado", resultado);
  const baseRango = `/accesos${paramsR.toString() ? "?" + paramsR.toString() : ""}`;

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Operación" title="Bitácora de accesos" description="Cada intento de ingreso queda registrado con su resultado y el motivo exacto de denegación." actions={<ButtonLink href="/kiosko" variante="success">Abrir kiosko</ButtonLink>} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Filtros param="resultado" base={baseResultado} actual={resultado ?? ""} opciones={[{ valor: "", label: "Todos", total: n("PERMITIDO") + n("DENEGADO") }, { valor: "PERMITIDO", label: "Permitidos", total: n("PERMITIDO") }, { valor: "DENEGADO", label: "Denegados", total: n("DENEGADO") }]} />
          <Filtros param="rango" base={baseRango} actual={rango === "hoy" ? "" : rango} opciones={[{ valor: "", label: "Hoy" }, { valor: "7d", label: "7 días" }, { valor: "30d", label: "30 días" }]} />
          <Link href={tipo ? "/accesos" : "/accesos?tipo=INVITADO"} className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs ${tipo ? "border-info/40 bg-info-soft text-info" : "border-line text-muted hover:text-fg"}`}>Solo invitados</Link>
        </div>
        <form action="/accesos" className="flex gap-2">
          {rango !== "hoy" && <input type="hidden" name="rango" value={rango} />}
          {resultado && <input type="hidden" name="resultado" value={resultado} />}
          <input name="q" defaultValue={q} className="input w-64" placeholder="Buscar socio o documento" />
        </form>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead><tr><th>Fecha y hora</th><th>Socio / valor</th><th>Método</th><th>Resultado</th><th>Detalle</th><th>Operador</th></tr></thead>
            <tbody>
              {accesos.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{formatoFechaHora(a.fecha)}</td>
                  <td>
                    {a.socio ? (
                      <Link href={`/socios/${a.socio.id}`} className="flex items-center gap-2.5">
                        <Avatar nombre={`${a.socio.nombres} ${a.socio.apellidos}`} foto={a.socio.fotoUrl} tam={24} />
                        <span className="font-medium">{a.socio.nombres} {a.socio.apellidos}</span>
                        {a.tipo === "INVITADO" && <Badge tono="info" punto={false}>Invitado</Badge>}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-muted">{a.valorIngresado}</span>
                    )}
                  </td>
                  <td className="text-xs text-muted">{a.metodo === "QR" ? "QR" : "Documento"}</td>
                  <td><Badge tono={a.resultado === "PERMITIDO" ? "ok" : "bad"}>{a.resultado === "PERMITIDO" ? "Permitido" : "Denegado"}</Badge></td>
                  <td className="max-w-xs truncate text-xs text-muted">{a.motivo}</td>
                  <td className="text-xs text-subtle">{a.usuario?.nombre ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {accesos.length === 0 && <Vacio titulo="Sin registros en el periodo" />}
        </div>
      </Card>
    </div>
  );
}
