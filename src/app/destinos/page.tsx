import Link from "next/link";
import { db } from "@/lib/db";
import { exigirInventario } from "@/lib/sesion";
import { incluirTarjeta } from "@/lib/consultas";
import Tarjeta from "@/components/Tarjeta";

export default async function Destinos() {
  await exigirInventario();
  const zonas = await db.zonaDestino.findMany({
    orderBy: { orden: "asc" },
    include: { articulos: { where: { decision: "llevar" }, include: incluirTarjeta, orderBy: { codigo: "asc" } } },
  });
  return (
    <>
      <h1>Por destino en la oficina nueva</h1>
      <p className="sutil">Lo que llega a cada zona. Sirve para ver si sobra o falta algo.</p>
      <nav className="fila" aria-label="Zonas">
        {zonas.map((z) => (
          <a key={z.id} href={`#z-${z.id}`} className="boton">{z.nombre} ({z.articulos.reduce((s, a) => s + a.cantidad, 0)})</a>
        ))}
      </nav>
      {zonas.map((z) => {
        const uds = z.articulos.reduce((s, a) => s + a.cantidad, 0);
        const porCat = new Map<string, number>();
        for (const a of z.articulos) porCat.set(a.nombre, (porCat.get(a.nombre) ?? 0) + a.cantidad);
        return (
          <section key={z.id} id={`z-${z.id}`}>
            <h2>{z.nombre} <span className="sutil">· {uds} {uds === 1 ? "unidad" : "unidades"}{!z.activa ? " · zona desactivada" : ""}</span></h2>
            {!z.articulos.length ? <p className="sutil">Nada asignado todavía.</p> : (
              <div className="rejilla">
                {z.articulos.map((a) => <Tarjeta key={a.codigo} a={a} href={`/a/${a.codigo}`} mostrarSala />)}
              </div>
            )}
          </section>
        );
      })}
      <p><Link href="/exportar">Descargar la lista para la mudanza</Link></p>
    </>
  );
}
