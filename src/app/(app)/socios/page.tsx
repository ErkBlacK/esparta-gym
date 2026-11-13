import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requerirSesion } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import { includeMembresias, sincronizarEstados } from "@/lib/servicios";
import { evaluarEstado, type MembresiaReglas } from "@/lib/reglas";
import { formatoFecha, hoy } from "@/lib/fechas";
import { formatoMoneda } from "@/lib/formato";
import type { EstadoSocioApp } from "@/lib/constants";
import { Avatar, ButtonLink, Card, EstadoBadge, Filtros, PageHeader, Vacio } from "@/components/ui";

export const metadata = { title: "Socios" };

const ESTADOS: EstadoSocioApp[] = ["ACTIVO", "VENCIDO", "CONGELADO", "BLOQUEADO_POR_MORA"];

export default async function SociosPage({ searchParams }: { searchParams: { q?: string; estado?: string } }) {
  const usuario = await requerirSesion();
  await sincronizarEstados();
  const q = (searchParams.q ?? "").trim();
  const estado = ESTADOS.includes(searchParams.estado as EstadoSocioApp) ? (searchParams.estado as EstadoSocioApp) : undefined;

  const where = {
    ...(estado ? { estado } : {}),
    ...(q
      ? { OR: [{ documento: { contains: q } }, { nombres: { contains: q } }, { apellidos: { contains: q } }, { email: { contains: q } }, { telefono: { contains: q } }] }
      : {}),
  };
  const [socios, conteos] = await Promise.all([
    prisma.socio.findMany({ where, include: includeMembresias, orderBy: [{ apellidos: "asc" }], take: 300 }),
    prisma.socio.groupBy({ by: ["estado"], _count: true, where: q ? { OR: where.OR } : {} }),
  ]);
  const dia = hoy();
  const total = conteos.reduce((a, c) => a + c._count, 0);
  const base = q ? `/socios?q=${encodeURIComponent(q)}` : "/socios";

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Operación"
        title="Socios"
        description="Perfiles, estado en tiempo real y membresía vigente."
        actions={puede(usuario.rol, "gestionarSocios") ? <ButtonLink href="/socios/nuevo">Registrar socio</ButtonLink> : null}
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Filtros
          param="estado"
          base={base}
          actual={estado ?? ""}
          opciones={[
            { valor: "", label: "Todos", total },
            ...ESTADOS.map((e) => ({ valor: e, label: e === "BLOQUEADO_POR_MORA" ? "En mora" : e.charAt(0) + e.slice(1).toLowerCase(), total: conteos.find((c) => c.estado === e)?._count ?? 0 })),
          ]}
        />
        <form className="flex gap-2" action="/socios">
          {estado && <input type="hidden" name="estado" value={estado} />}
          <input name="q" defaultValue={q} placeholder="Buscar por nombre, documento o teléfono" className="input w-72" />
        </form>
      </div>

      <Card className="overflow-hidden">
        {socios.length === 0 ? (
          <Vacio titulo="Sin resultados" descripcion="Ajusta la búsqueda o los filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Socio</th>
                  <th>Documento</th>
                  <th>Plan vigente</th>
                  <th>Vence</th>
                  <th className="text-right">Saldo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {socios.map((s) => {
                  const ev = evaluarEstado(s.membresias as unknown as MembresiaReglas[], dia);
                  const ref = ev.vigente ?? ev.ultimaVencida;
                  return (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/socios/${s.id}`} className="flex items-center gap-3">
                          <Avatar nombre={`${s.nombres} ${s.apellidos}`} foto={s.fotoUrl} tam={30} />
                          <span>
                            <span className="block font-medium">{s.nombres} {s.apellidos}</span>
                            <span className="block text-2xs text-subtle">{s.telefono}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="font-mono text-xs text-muted">{s.tipoDocumento} {s.documento}</td>
                      <td className="text-muted">{ev.vigente?.plan.nombre ?? <span className="text-subtle">—</span>}</td>
                      <td className="whitespace-nowrap">
                        {ref ? (
                          <span className={ev.vigente && ev.diasRestantes <= 5 ? "text-warn" : "text-muted"}>
                            {formatoFecha(ref.fechaFinAjustada)}
                            {ev.vigente && <span className="ml-1.5 font-mono text-2xs text-subtle">{ev.diasRestantes}d</span>}
                          </span>
                        ) : (
                          <span className="text-subtle">Sin membresía</span>
                        )}
                      </td>
                      <td className="text-right font-mono text-xs tabular">{ev.saldoPendienteTotal > 0 ? <span className="text-bad">{formatoMoneda(ev.saldoPendienteTotal)}</span> : <span className="text-subtle">—</span>}</td>
                      <td><EstadoBadge estado={ev.estado} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
