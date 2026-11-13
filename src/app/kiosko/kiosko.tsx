"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { validarIngreso, type RespuestaKiosko } from "@/acciones/acceso";
import { Marca } from "@/components/shell";
import { cn, iniciales } from "@/lib/formato";

const DURACION_MS = 4500;

type Historial = { id: number; nombre: string; permitido: boolean; detalle: string; hora: string };

function tono(ctx: AudioContext, freq: number, ms: number, tipo: OscillatorType, inicio = 0) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = tipo;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
  g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + inicio + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + ms / 1000);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + inicio);
  o.stop(ctx.currentTime + inicio + ms / 1000 + 0.05);
}

export function Kiosko({ gym, operador }: { gym: string; operador: string }) {
  const [valor, setValor] = useState("");
  const [resultado, setResultado] = useState<RespuestaKiosko | null>(null);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [pendiente, iniciar] = useTransition();
  const [reloj, setReloj] = useState<string>("");
  const [camara, setCamara] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const ocupadoRef = useRef(false);

  useEffect(() => {
    const t = () => setReloj(new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }));
    t();
    const i = setInterval(t, 1000);
    return () => clearInterval(i);
  }, []);

  const reiniciar = useCallback(() => {
    setResultado(null);
    setValor("");
    ocupadoRef.current = false;
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  const sonar = useCallback((ok: boolean) => {
    try {
      audioRef.current ??= new AudioContext();
      const ctx = audioRef.current;
      if (ok) {
        tono(ctx, 880, 120, "sine");
        tono(ctx, 1320, 160, "sine", 0.12);
      } else {
        tono(ctx, 220, 380, "square");
      }
    } catch {}
  }, []);

  const validar = useCallback(
    (entrada: string) => {
      const v = entrada.trim();
      if (!v || ocupadoRef.current) return;
      ocupadoRef.current = true;
      iniciar(async () => {
        const r = await validarIngreso(v);
        setResultado(r);
        if ("error" in r) {
          ocupadoRef.current = false;
          return;
        }
        sonar(r.permitido);
        setHistorial((h) =>
          [
            {
              id: Date.now(),
              nombre: r.socio?.nombre ?? v,
              permitido: r.permitido,
              detalle: r.permitido ? r.plan : r.motivo,
              hora: r.hora,
            },
            ...h,
          ].slice(0, 12),
        );
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(reiniciar, DURACION_MS);
      });
    },
    [reiniciar, sonar],
  );

  // Escáner de cámara (html5-qrcode cargado solo en el navegador)
  useEffect(() => {
    if (!camara) return;
    let escaner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelado = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelado) return;
        const inst = new Html5Qrcode("lector-qr", { verbose: false });
        escaner = inst as unknown as typeof escaner;
        await inst.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (texto) => validar(texto),
          () => undefined,
        );
        setErrorCamara(null);
      } catch {
        setErrorCamara("No fue posible acceder a la cámara. Verifica los permisos del navegador o usa un lector USB.");
        setCamara(false);
      }
    })();
    return () => {
      cancelado = true;
      if (escaner) escaner.stop().then(() => escaner?.clear()).catch(() => undefined);
    };
  }, [camara, validar]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && resultado) {
        clearTimeout(timerRef.current);
        reiniciar();
      }
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [resultado, reiniciar]);

  const r = resultado && !("error" in resultado) ? resultado : null;
  const error = resultado && "error" in resultado ? resultado.error : null;

  return (
    <div className="dark flex min-h-screen flex-col bg-bg text-fg">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <Marca tam={30} />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">{gym}</div>
            <div className="font-mono text-2xs text-subtle">Punto de entrada · Torniquete 01</div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right leading-tight">
            <div className="font-mono text-lg tabular">{reloj}</div>
            <div className="text-2xs text-subtle">Operador: {operador}</div>
          </div>
          <Link href="/dashboard" className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-fg">
            Salir del kiosko
          </Link>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_340px]">
        <section className="relative flex flex-col items-center justify-center px-6 py-12">
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgb(var(--line))_1px,transparent_1px)] [background-size:22px_22px]" />
          <div className="relative w-full max-w-xl text-center">
            <div className="mb-2 font-mono text-2xs uppercase tracking-[0.24em] text-subtle">Validación de ingreso</div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Escanea tu QR o digita tu documento</h1>
            <form
              className="mt-10"
              onSubmit={(e) => {
                e.preventDefault();
                validar(valor);
              }}
            >
              <div className="group relative">
                <input
                  ref={inputRef}
                  autoFocus
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  onBlur={() => !resultado && setTimeout(() => inputRef.current?.focus(), 200)}
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Documento o código"
                  className="h-20 w-full rounded-2xl border border-line bg-surface px-6 text-center font-mono text-3xl tracking-widest text-fg outline-none transition placeholder:font-sans placeholder:text-xl placeholder:tracking-normal placeholder:text-subtle focus:border-ok/60 focus:ring-8 focus:ring-ok/10"
                />
                {pendiente && <span className="absolute right-6 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin rounded-full border-2 border-ok border-t-transparent" />}
              </div>
              <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted">
                <span className="kbd">Enter</span> validar
                <span className="text-line">|</span>
                <button type="button" onClick={() => setCamara((c) => !c)} className="rounded-md border border-line px-2.5 py-1 hover:text-fg">
                  {camara ? "Apagar cámara" : "Usar cámara"}
                </button>
              </div>
              {errorCamara && <div className="mt-3 text-xs text-warn">{errorCamara}</div>}
              {error && <div className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</div>}
            </form>
            {camara && <div id="lector-qr" className="mx-auto mt-6 w-full max-w-xs overflow-hidden rounded-2xl border border-line" />}
          </div>
        </section>

        <aside className="border-t border-line bg-surface/50 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-xs font-medium">Últimos ingresos</span>
            <span className="font-mono text-2xs text-subtle">esta sesión</span>
          </div>
          <ul className="space-y-px px-2 pb-4">
            {historial.map((h) => (
              <li key={h.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 animate-fade-in">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", h.permitido ? "bg-ok" : "bg-bad")} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{h.nombre}</div>
                  <div className="truncate text-2xs text-subtle">{h.detalle}</div>
                </div>
                <span className="font-mono text-2xs text-subtle">{h.hora}</span>
              </li>
            ))}
            {historial.length === 0 && <li className="px-3 py-10 text-center text-xs text-subtle">Aún no hay validaciones.</li>}
          </ul>
        </aside>
      </div>

      {r && (
        <div
          className={cn("fixed inset-0 z-50 flex animate-scale-in flex-col items-center justify-center p-6", r.permitido ? "bg-[#03130d]" : "bg-[#1a0606]")}
          onClick={() => {
            clearTimeout(timerRef.current);
            reiniciar();
          }}
        >
          <div className={cn("absolute inset-x-0 top-0 h-1.5 origin-left animate-barrido", r.permitido ? "bg-ok" : "bg-bad")} style={{ animationDuration: `${DURACION_MS}ms` }} />
          <div className={cn("absolute inset-0 opacity-60", r.permitido ? "[background:radial-gradient(60%_50%_at_50%_40%,rgb(16_185_129/0.25),transparent)]" : "[background:radial-gradient(60%_50%_at_50%_40%,rgb(239_68_68/0.25),transparent)]")} />
          <div className="relative flex w-full max-w-3xl flex-col items-center text-center">
            <div className={cn("mb-8 inline-flex items-center gap-3 rounded-full px-5 py-2 font-mono text-sm uppercase tracking-[0.3em] ring-1", r.permitido ? "bg-ok/15 text-ok ring-ok/40" : "bg-bad/15 text-bad ring-bad/40")}>
              <span className={cn("h-2.5 w-2.5 rounded-full", r.permitido ? "bg-ok" : "bg-bad", "animate-pulsar")} />
              {r.permitido ? "Acceso permitido" : "Acceso denegado"}
            </div>

            {r.socio && (
              <div className={cn("mb-6 overflow-hidden rounded-full ring-4", r.permitido ? "ring-ok/60" : "ring-bad/60")} style={{ width: 168, height: 168 }}>
                {r.socio.fotoUrl ? (
                  <img src={r.socio.fotoUrl} alt={r.socio.nombre} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-5xl font-semibold text-white/90">{iniciales(r.socio.nombre)}</div>
                )}
              </div>
            )}

            <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">{r.socio?.nombre ?? "No registrado"}</h2>
            {r.socio && <div className="mt-2 font-mono text-sm text-white/50">{r.socio.documento}</div>}

            {r.permitido ? (
              <div className="mt-10 grid w-full max-w-2xl grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-xs text-white/50">Plan</div>
                  <div className="mt-2 text-lg font-semibold text-white">{r.plan}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-xs text-white/50">Días restantes</div>
                  <div className={cn("mt-2 text-3xl font-semibold tabular", r.diasRestantes <= 5 ? "text-warn" : "text-ok")}>{r.diasRestantes}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-xs text-white/50">{r.socio.locker ? "Locker" : "Vence"}</div>
                  <div className="mt-2 text-lg font-semibold text-white">{r.socio.locker ? `#${r.socio.locker}` : r.venceEl}</div>
                </div>
              </div>
            ) : (
              <div className="mt-10 w-full max-w-2xl rounded-2xl border border-bad/30 bg-bad/10 px-6 py-6">
                <div className="text-xs uppercase tracking-widest text-bad/80">Motivo</div>
                <div className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{r.motivo}</div>
                <div className="mt-3 text-sm text-white/50">Dirígete a recepción para resolverlo.</div>
              </div>
            )}

            {r.permitido && r.avisos.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {r.avisos.map((a) => (
                  <span key={a} className="rounded-full bg-warn/15 px-3 py-1 text-xs text-warn ring-1 ring-warn/30">
                    {a}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-10 font-mono text-2xs uppercase tracking-[0.2em] text-white/40">
              {r.permitido ? "Señal enviada al torniquete · puerta liberada" : "Torniquete bloqueado · intento registrado"} · {r.hora}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
