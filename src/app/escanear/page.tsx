import { exigirInventario } from "@/lib/sesion";
import Escaner from "./Escaner";

export default async function Escanear() {
  await exigirInventario();
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1>Escanear etiqueta</h1>
      <p className="sutil">Apunta al código QR de la etiqueta y se abrirá la ficha del artículo.</p>
      <Escaner />
    </div>
  );
}
