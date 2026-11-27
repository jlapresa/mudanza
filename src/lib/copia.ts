import { db } from "./db";
import { guardar } from "./almacen";

// Copia diaria de la base de datos en el almacenamiento privado (copias/AAAA-MM-DD.json).
// Las fotos ya viven en ese almacenamiento y la app nunca las borra de él
// (borrar una foto solo la quita de la ficha), así que copia + almacenamiento bastan para restaurar.
export async function copiaDiaria(ahora = new Date()) {
  const [salas, zonas, usuarios, articulos, fotos, peticiones, eventos, avisos, ajustes] = await Promise.all([
    db.salaOrigen.findMany(), db.zonaDestino.findMany(), db.usuario.findMany(), db.articulo.findMany(),
    db.foto.findMany(), db.peticion.findMany(), db.evento.findMany(), db.aviso.findMany(), db.ajuste.findMany(),
  ]);
  const datos = { version: 1, fecha: ahora.toISOString(), salas, zonas, usuarios, articulos, fotos, peticiones, eventos, avisos, ajustes };
  const clave = `copias/${ahora.toISOString().slice(0, 10)}.json`;
  await guardar(clave, Buffer.from(JSON.stringify(datos)), "application/json");
  await borrarAntiguas(30);
  return clave;
}

async function borrarAntiguas(dias: number) {
  const limite = new Date(Date.now() - dias * 86400_000).toISOString().slice(0, 10);
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { list, del } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "copias/" });
    const viejas = blobs.filter((b) => b.pathname.slice(7, 17) < limite).map((b) => b.url);
    if (viejas.length) await del(viejas);
    return;
  }
  const { promises: fs } = await import("fs");
  const path = await import("path");
  const dir = path.resolve(process.env.ALMACEN_DIR ?? "./datos/fotos", "copias");
  for (const f of await fs.readdir(dir).catch(() => [] as string[]))
    if (f.slice(0, 10) < limite) await fs.unlink(path.join(dir, f));
}
