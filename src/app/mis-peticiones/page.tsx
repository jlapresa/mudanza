import Link from "next/link";
import { db } from "@/lib/db";
import { exigirSesion } from "@/lib/sesion";
import { ESTADO_PETICION, fecha } from "@/lib/textos";
import { Miniatura } from "@/components/Tarjeta";
import Pedir from "@/components/Pedir";

export default async function MisPeticiones() {
  const u = await exigirSesion();
  const ps = await db.peticion.findMany({
    where: { usuarioId: u.id },
    orderBy: { creadaEn: "desc" },
    include: { articulo: { include: { fotos: { where: { principal: true }, take: 1 }, salaOrigen: true } } },
  });
  return (
    <>
      <h1>Mis peticiones</h1>
      {!ps.length && <p>No has pedido nada todavía. <Link href="/mercadillo">Ir al mercadillo</Link></p>}
      <div className="rejilla anchas">
        {ps.map((p) => (
          <div key={p.id} className="tarjeta">
            <Miniatura fotoId={p.articulo.fotos[0]?.id} nombre={p.articulo.nombre} />
            <div className="cuerpo">
              <span className="titulo">{p.articulo.nombre}</span>
              <span className="meta">Pedido el {fecha(p.creadaEn, true)} · {p.cantidad} {p.cantidad === 1 ? "unidad" : "unidades"}</span>
              <span className={`etiqueta ${p.estado === "asignada" || p.estado === "recogida" ? "llevar" : p.estado === "abierta" ? "info" : "pendiente"}`}>
                {ESTADO_PETICION[p.estado]}
              </span>
              {p.estado === "asignada" && p.recogidaLimite && (
                <span className="meta">Recógelo en {p.articulo.salaOrigen.nombre} antes del {fecha(p.recogidaLimite)}.</span>
              )}
              {p.estado === "abierta" && <Pedir articuloId={p.articuloId} nombre={p.articulo.nombre} max={1} abierto miPeticion={{ id: p.id, estado: p.estado, cantidad: p.cantidad }} />}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
