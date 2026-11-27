import Link from "next/link";
import { db } from "@/lib/db";
import { exigirInventario } from "@/lib/sesion";
import { Miniatura } from "@/components/Tarjeta";

export default async function Salas() {
  await exigirInventario();
  const salas = await db.salaOrigen.findMany({
    orderBy: { orden: "asc" },
    include: {
      articulos: { select: { decision: true, fotos: { where: { principal: true }, take: 1, select: { id: true } } } },
    },
  });
  const plantas = [...new Set(salas.map((s) => s.planta))];
  return (
    <>
      <h1>Salas de la oficina actual</h1>
      {plantas.map((p) => (
        <section key={p}>
          <h2>{p}</h2>
          <div className="rejilla">
            {salas.filter((s) => s.planta === p).map((s) => {
              const pend = s.articulos.filter((a) => a.decision === "pendiente").length;
              const foto = s.articulos.find((a) => a.fotos.length)?.fotos[0]?.id;
              return (
                <Link key={s.id} href={`/salas/${s.id}`} className="tarjeta">
                  <Miniatura fotoId={foto} nombre={s.nombre} />
                  <div className="cuerpo">
                    <span className="titulo">{s.nombre}</span>
                    <span className="meta">{s.articulos.length} artículos</span>
                    <span className={`etiqueta ${pend ? "pendiente" : "llevar"}`}>{pend ? `${pend} por decidir` : "Todo decidido"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
