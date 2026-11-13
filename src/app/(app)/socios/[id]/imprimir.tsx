"use client";
export function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="no-print text-xs text-muted hover:text-fg">
      Imprimir
    </button>
  );
}
