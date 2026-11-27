import { SALIDA } from "@/lib/textos";
import type { Filtros as F } from "@/lib/articulos";

export default function Filtros({ f, zonas, accion }: { f: F; zonas: { id: string; nombre: string }[]; accion: string }) {
  return (
    <form className="filtros" action={accion} method="get" role="search">
      <div className="q">
        <label htmlFor="q" className="visualmente-oculto">Buscar</label>
        <input id="q" name="q" type="search" defaultValue={f.q} placeholder="Buscar por nombre, código o descripción" />
      </div>
      <select name="decision" defaultValue={f.decision} aria-label="Decisión">
        <option value="">Toda decisión</option>
        <option value="pendiente">Pendiente</option>
        <option value="llevar">Se lleva</option>
        <option value="no_llevar">No se lleva</option>
      </select>
      <select name="zona" defaultValue={f.zona} aria-label="Zona de destino">
        <option value="">Toda zona</option>
        {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
      </select>
      <select name="salida" defaultValue={f.salida} aria-label="Salida">
        <option value="">Toda salida</option>
        {Object.entries(SALIDA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select name="foto" defaultValue={f.foto} aria-label="Foto">
        <option value="">Con o sin foto</option>
        <option value="con">Con foto</option>
        <option value="sin">Sin foto</option>
      </select>
      <select name="peticiones" defaultValue={f.peticiones} aria-label="Peticiones">
        <option value="">Con o sin peticiones</option>
        <option value="si">Con peticiones</option>
      </select>
      <button type="submit" className="primario">Filtrar</button>
    </form>
  );
}
