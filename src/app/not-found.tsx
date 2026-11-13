import Link from "next/link";
export default function NoEncontrado() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <div className="font-mono text-2xs uppercase tracking-[0.2em] text-subtle">404</div>
      <h1 className="text-xl font-semibold">No encontramos lo que buscas</h1>
      <Link href="/dashboard" className="text-xs text-ok hover:underline">Volver al resumen</Link>
    </main>
  );
}
