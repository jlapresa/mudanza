import Link from "next/link";
import { exigirInventario } from "@/lib/sesion";

export default async function Exportar() {
  await exigirInventario();
  const fila = (t: string, d: string, enlaces: [string, string][]) => (
    <li>
      <b>{t}</b>
      <p className="sutil" style={{ margin: "4px 0 8px" }}>{d}</p>
      <div className="fila">{enlaces.map(([h, x]) => <a key={h} className="boton" href={h} download>{x}</a>)}</div>
    </li>
  );
  return (
    <div style={{ maxWidth: 720 }}>
      <h1>Listas y exportaciones</h1>
      <ul className="lista">
        {fila("Lista para la mudanza", "Lo que se lleva, agrupado por zona de destino, con foto, código, medidas y sala de origen.", [["/api/exportar/mudanza.pdf", "PDF"], ["/api/exportar/mudanza.xlsx", "Excel"]])}
        <li>
          <b>Etiquetas</b>
          <p className="sutil" style={{ margin: "4px 0 8px" }}>Una por unidad que se lleva, con código QR y zona de destino en grande. Hoja adhesiva A4 de 24 etiquetas (70 × 37 mm).</p>
          <Link className="boton" href="/etiquetas">Preparar etiquetas</Link>
        </li>
        {fila("Lista de salidas", "Lo que no se lleva, agrupado por salida, con la persona asignada en el caso del equipo.", [["/api/exportar/salidas.pdf", "PDF"], ["/api/exportar/salidas.xlsx", "Excel"]])}
        {fila("Exportación completa", "Todas las columnas, incluidas las del inventario original, y el historial de cambios.", [["/api/exportar/completo.xlsx", "Excel"]])}
      </ul>
    </div>
  );
}
