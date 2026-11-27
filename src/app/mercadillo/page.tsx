import Link from "next/link";
import { db } from "@/lib/db";
import { exigirSesion, puedeEditar } from "@/lib/sesion";
import { plazoMercadillo } from "@/lib/ajustes";
import { enMercadillo } from "@/lib/mercadillo";
import { ESTADO, fecha } from "@/lib/textos";
import { Miniatura } from "@/components/Tarjeta";
import Pedir from "@/components/Pedir";

export default async function Mercadillo() {
  const u = await exigirSesion();
  const plazo = await plazoMercadillo();
  const articulos = await db.articulo.findMany({
    where: enMercadillo,
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    include: {
      salaOrigen: true,
      fotos: { where: { principal: true }, take: 1 },
      peticiones: { where: { estado: { in: ["abierta", "asignada", "recogida"] } } },
    },
  });
  const verAntes = plazo.antes && !puedeEditar(u);
  return (
    <>
      <h1>Mercadillo interno</h1>
      <p className={plazo.abierto ? "ok-banda" : "aviso-banda"} role="status">
        {plazo.antes && `Abre el ${fecha(plazo.apertura)} y cierra el ${fecha(plazo.cierre)}.`}
        {plazo.abierto && `Abierto hasta el ${fecha(plazo.cierre, true)}. Se asigna por orden de llegada.`}
        {plazo.cerrado && `Cerró el ${fecha(plazo.cierre)}. Ya no se admiten peticiones.`}
      </p>
      <p className="sutil">Muebles que no nos llevamos a la oficina nueva. Si algo te interesa, pídelo. <Link href="/mis-peticiones">Mis peticiones</Link></p>
      {verAntes ? <p>Vuelve el día de apertura para ver qué hay.</p> : !articulos.length ? <p>Todavía no hay nada en el mercadillo.</p> : (
        <div className="rejilla anchas">
          {articulos.map((a) => {
            const ocupadas = a.peticiones.filter((p) => p.estado !== "abierta").reduce((s, p) => s + p.cantidad, 0);
            const libres = a.cantidad - ocupadas;
            const mia = a.peticiones.find((p) => p.usuarioId === u.id) ?? null;
            const pedidas = a.peticiones.filter((p) => p.estado === "abierta").length;
            return (
              <div key={a.id} id={a.codigo} className="tarjeta">
                <Miniatura fotoId={a.fotos[0]?.id} nombre={a.nombre} />
                <div className="cuerpo">
                  <span className="titulo">{a.nombre}</span>
                  <span className="meta">
                    {a.cantidad} {a.cantidad === 1 ? "unidad" : "unidades"}
                    {a.medidas ? ` · ${a.medidas}` : ""}
                    {a.estado ? ` · ${ESTADO[a.estado]}` : ""}
                  </span>
                  <span className="meta">Ahora en {a.salaOrigen.nombre} ({a.salaOrigen.planta})</span>
                  <span className="etiqueta info">
                    {pedidas ? `${pedidas} ${pedidas === 1 ? "persona lo ha pedido" : "personas lo han pedido"}` : "Nadie lo ha pedido"}
                  </span>
                  {libres <= 0 && !mia ? <span className="etiqueta pendiente">Ya asignado</span> : (
                    <Pedir articuloId={a.id} nombre={a.nombre} max={Math.max(1, libres)} abierto={plazo.abierto}
                      miPeticion={mia ? { id: mia.id, estado: mia.estado, cantidad: mia.cantidad } : null} />
                  )}
                  {puedeEditar(u) && <Link href={`/a/${a.codigo}`} className="sutil">Ver ficha</Link>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
