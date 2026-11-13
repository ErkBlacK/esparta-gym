"use client";
export default function ErrorModulo({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="font-mono text-2xs uppercase tracking-[0.2em] text-bad">Error</div>
      <h2 className="mt-2 text-lg font-semibold">No se pudo cargar este módulo</h2>
      <p className="mt-2 text-xs text-muted">Verifica la conexión con la base de datos. {error.digest && <span className="font-mono">({error.digest})</span>}</p>
      <button onClick={reset} className="mt-5 h-9 rounded-lg border border-line px-4 text-xs hover:bg-elevated">Reintentar</button>
    </div>
  );
}
