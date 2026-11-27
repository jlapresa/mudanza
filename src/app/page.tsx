import Link from "next/link";
import { db } from "@/lib/db";
import { exigirInventario } from "@/lib/sesion";
import { plazoMercadillo } from "@/lib/ajustes";
import { fecha } from "@/lib/textos";

export default async function Inicio() {
  await exigirInventario();
  const [total, decididos, sinFoto, peticiones, enMercadillo, salas, plazo] = await Promise.all([
    db.articulo.count(),
    db.articulo.count({ where: { decision: { not: "pendiente" } } }),
    db.articulo.count({ where: { fotos: { none: {} } } }),
    db.peticion.count({ where: { estado: "abierta" } }),
    db.articulo.count({ where: { decision: "no_llevar", salida: "ofrecer_equipo" } }),
    db.salaOrigen.findMany({ orderBy: { orden: "asc" }, include: { articulos: { select: { decision: true } } } }),
    plazoMercadillo(),
  ]);
  const pct = total ? Math.round((decididos / total) * 100) : 0;
  return (
    <>
      <h1>Mudanza de la oficina</h1>
      <div className="cifras">
        <Link className="cifra" href="/articulos"><b>{total}</b><span>artículos</span></Link>
        <Link className="cifra" href="/articulos?decision=llevar"><b>{decididos}</b><span>decididos</span></Link>
        <Link className="cifra" href="/articulos?decision=pendiente"><b>{total - decididos}</b><span>pendientes</span></Link>
        <Link className="cifra" href="/articulos?foto=sin"><b>{sinFoto}</b><span>sin foto</span></Link>
        <Link className="cifra" href="/peticiones"><b>{peticiones}</b><span>peticiones abiertas</span></Link>
      </div>
      <h2>Avance: {pct} %</h2>
      <div className="barra" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance global"><i style={{ width: `${pct}%` }} /></div>

      <div className="fila" style={{ margin: "20px 0" }}>
        <Link className="boton primario" href="/articulos?decision=pendiente">Sin decidir</Link>
        <Link className="boton" href="/articulos?foto=sin">Sin foto</Link>
        <Link className="boton" href="/mercadillo">Mercadillo ({enMercadillo})</Link>
      </div>
      <p className="sutil">
        Mercadillo: del {fecha(plazo.apertura)} al {fecha(plazo.cierre)}.{" "}
        {plazo.antes ? "Todavía no ha abierto." : plazo.abierto ? "Abierto ahora." : "Cerrado."}
      </p>

      <h2>Por sala</h2>
      <div>
        {salas.map((s) => {
          const n = s.articulos.length;
          const d = s.articulos.filter((a) => a.decision !== "pendiente").length;
          const p = n ? Math.round((d / n) * 100) : 0;
          return (
            <div key={s.id} className="progreso-sala">
              <Link href={`/salas/${s.id}`}>{s.nombre} <span className="sutil">· {s.planta}</span></Link>
              <div className="barra" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance en ${s.nombre}`}><i style={{ width: `${p}%` }} /></div>
              <span className="sutil">{d}/{n}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
