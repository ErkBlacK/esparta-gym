"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const EJE = { fontSize: 11, fill: "rgb(var(--subtle))" };
const VERDE = "#10B981";
const ROJO = "#EF4444";

const moneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const compacto = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

function Caja({ titulo, filas }: { titulo: string; filas: { label: string; valor: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <div className="mb-1 font-medium text-fg">{titulo}</div>
      {filas.map((f) => (
        <div key={f.label} className="flex items-center gap-2 text-muted">
          {f.color && <span className="h-2 w-2 rounded-sm" style={{ background: f.color }} />}
          <span>{f.label}</span>
          <span className="ml-auto pl-4 font-mono text-fg tabular">{f.valor}</span>
        </div>
      ))}
    </div>
  );
}

type Tip = { active?: boolean; label?: any; payload?: ReadonlyArray<any> };

export function GraficoIngresos({ datos, alto = 220 }: { datos: { dia: string; total: number }[]; alto?: number }) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <AreaChart data={datos} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gIngresos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VERDE} stopOpacity={0.22} />
            <stop offset="100%" stopColor={VERDE} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="2 4" />
        <XAxis dataKey="dia" tick={EJE} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={EJE} tickLine={false} axisLine={false} tickFormatter={compacto} width={44} />
        <Tooltip
          cursor={{ stroke: "rgb(var(--subtle))", strokeDasharray: "3 3" }}
          content={(p: Tip) =>
            p.active && p.payload?.length ? <Caja titulo={String(p.label)} filas={[{ label: "Ingresos", valor: moneda.format(Number(p.payload[0]!.value)), color: VERDE }]} /> : null
          }
        />
        <Area type="monotone" dataKey="total" stroke={VERDE} strokeWidth={2} fill="url(#gIngresos)" activeDot={{ r: 4, stroke: "rgb(var(--surface))", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function GraficoHoras({ datos, alto = 220 }: { datos: { hora: string; accesos: number }[]; alto?: number }) {
  const max = Math.max(...datos.map((d) => d.accesos), 1);
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={datos} margin={{ top: 10, right: 4, left: -6, bottom: 0 }} barCategoryGap={3}>
        <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="2 4" />
        <XAxis dataKey="hora" tick={EJE} tickLine={false} axisLine={false} interval={1} />
        <YAxis tick={EJE} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
        <Tooltip
          cursor={{ fill: "rgb(var(--elevated))" }}
          content={(p: Tip) =>
            p.active && p.payload?.length ? <Caja titulo={`${p.label}:00 – ${p.label}:59`} filas={[{ label: "Ingresos", valor: String(p.payload[0]!.value), color: VERDE }]} /> : null
          }
        />
        <Bar
          dataKey="accesos"
          radius={[4, 4, 0, 0]}
          shape={(props: unknown) => {
            const { x, y, width, height, payload } = props as { x: number; y: number; width: number; height: number; payload: { accesos: number } };
            const intensidad = 0.35 + 0.65 * (payload.accesos / max);
            return <rect x={x} y={y} width={width} height={Math.max(0, height)} rx={3} fill={VERDE} fillOpacity={intensidad} />;
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoPlanes({ datos, alto = 220 }: { datos: { plan: string; ventas: number; ingresos: number }[]; alto?: number }) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="plan" tick={{ ...EJE, fill: "rgb(var(--muted))" }} tickLine={false} axisLine={false} width={130} />
        <Tooltip
          cursor={{ fill: "rgb(var(--elevated))" }}
          content={(p: Tip) => {
            if (!p.active || !p.payload?.length) return null;
            const d = (p.payload[0] as unknown as { payload: { ventas: number; ingresos: number } }).payload;
            return <Caja titulo={String(p.label)} filas={[{ label: "Vendidas", valor: String(d.ventas), color: VERDE }, { label: "Ingresos", valor: moneda.format(d.ingresos) }]} />;
          }}
        />
        <Bar dataKey="ventas" fill={VERDE} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoAccesosDiarios({ datos, alto = 220 }: { datos: { dia: string; permitidos: number; denegados: number }[]; alto?: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-4 px-1 text-2xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-ok" />Permitidos</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-bad" />Denegados</span>
      </div>
      <ResponsiveContainer width="100%" height={alto}>
        <BarChart data={datos} margin={{ top: 4, right: 4, left: -6, bottom: 0 }} barCategoryGap={4}>
          <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="2 4" />
          <XAxis dataKey="dia" tick={EJE} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis tick={EJE} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
          <Tooltip
            cursor={{ fill: "rgb(var(--elevated))" }}
            content={(p: Tip) =>
              p.active && p.payload?.length ? (
                <Caja
                  titulo={String(p.label)}
                  filas={[
                    { label: "Permitidos", valor: String(p.payload.find((x) => x.dataKey === "permitidos")?.value ?? 0), color: VERDE },
                    { label: "Denegados", valor: String(p.payload.find((x) => x.dataKey === "denegados")?.value ?? 0), color: ROJO },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="permitidos" stackId="a" fill={VERDE} stroke="rgb(var(--surface))" strokeWidth={1} />
          <Bar dataKey="denegados" stackId="a" fill={ROJO} radius={[4, 4, 0, 0]} stroke="rgb(var(--surface))" strokeWidth={1} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
