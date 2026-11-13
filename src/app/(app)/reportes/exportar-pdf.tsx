"use client";

import { useState } from "react";
import { botonClases } from "@/components/ui-client";

export type DatosPdf = {
  gym: string;
  periodo: string;
  generado: string;
  kpis: [string, string][];
  ingresosDiarios: [string, string][];
  porMetodo: [string, string][];
  planes: [string, string, string][];
  horas: [string, string][];
  motivos: [string, string][];
};

/** Genera el informe gerencial en PDF en el navegador (jsPDF + autotable). */
export function ExportarPdf({ datos }: { datos: DatosPdf }) {
  const [generando, setGenerando] = useState(false);
  async function generar() {
    setGenerando(true);
    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const verde: [number, number, number] = [16, 185, 129];
      doc.setFillColor(9, 9, 11);
      doc.rect(0, 0, 595, 78, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text(`${datos.gym} · Informe gerencial`, 40, 40);
      doc.setFontSize(10);
      doc.setTextColor(161, 161, 170);
      doc.text(`Periodo: ${datos.periodo}   ·   Generado: ${datos.generado}`, 40, 60);
      doc.setTextColor(9, 9, 11);
      const estilo = { headStyles: { fillColor: verde, textColor: 255, fontStyle: "bold" as const }, styles: { fontSize: 9, cellPadding: 5 }, margin: { left: 40, right: 40 } };
      let y = 100;
      const tabla = (titulo: string, head: string[], body: string[][]) => {
        doc.setFontSize(12);
        doc.text(titulo, 40, y);
        autoTable(doc, { ...estilo, startY: y + 8, head: [head], body });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;
        if (y > 720) {
          doc.addPage();
          y = 50;
        }
      };
      tabla("Indicadores clave", ["Indicador", "Valor"], datos.kpis);
      tabla("Recaudo por método de pago", ["Método", "Total"], datos.porMetodo);
      tabla("Membresías vendidas por plan", ["Plan", "Cantidad", "Ingresos"], datos.planes);
      tabla("Asistencia por hora (horas pico)", ["Hora", "Ingresos"], datos.horas);
      tabla("Motivos de acceso denegado", ["Motivo", "Intentos"], datos.motivos.length ? datos.motivos : [["Sin denegaciones", "0"]]);
      tabla("Ingresos por día", ["Fecha", "Total"], datos.ingresosDiarios);
      const paginas = doc.getNumberOfPages();
      for (let i = 1; i <= paginas; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(113, 113, 122);
        doc.text(`Página ${i} de ${paginas}`, 520, 820);
      }
      doc.save(`informe_${datos.periodo.replace(/[^\d]+/g, "_")}.pdf`);
    } finally {
      setGenerando(false);
    }
  }
  return (
    <button type="button" onClick={generar} disabled={generando} className={botonClases("primary")}>
      {generando ? "Generando…" : "Exportar PDF"}
    </button>
  );
}
