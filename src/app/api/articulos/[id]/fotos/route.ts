import sharp from "sharp";
import { manejar, apiUsuario, ErrorApi } from "@/lib/sesion";
import { db } from "@/lib/db";
import { guardar } from "@/lib/almacen";
import { registrar, unaVez } from "@/lib/historial";

export const POST = manejar(async (req, { params }) => {
  const u = await apiUsuario("inventario");
  const { id } = await params;
  const a = await db.articulo.findUnique({ where: { id }, include: { _count: { select: { fotos: true } } } });
  if (!a) throw new ErrorApi(404, "Artículo no encontrado.");
  const fd = await req.formData();
  const foto = fd.get("foto");
  if (!(foto instanceof Blob) || foto.size === 0) throw new ErrorApi(400, "No ha llegado ninguna foto.");
  if (foto.size > 15 * 1024 * 1024) throw new ErrorApi(400, "La foto es demasiado grande.");

  const r = await unaVez(req.headers.get("x-operacion"), async () => {
    const entrada = Buffer.from(await foto.arrayBuffer());
    // El navegador ya la comprime; aquí se garantiza el tamaño y se normaliza a JPEG.
    let grande: Buffer, mini: Buffer, meta: { width: number; height: number };
    try {
      const g = await sharp(entrada).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true });
      grande = g.data;
      meta = g.info;
      mini = await sharp(grande).resize({ width: 400, height: 400, fit: "inside" }).jpeg({ quality: 72 }).toBuffer();
    } catch {
      throw new ErrorApi(400, "El archivo no parece una imagen.");
    }
    const base = `${a.codigo}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await guardar(`${base}.jpg`, grande);
    await guardar(`${base}-mini.jpg`, mini);
    return db.$transaction(async (tx) => {
      const f = await tx.foto.create({
        data: { articuloId: id, clave: `${base}.jpg`, claveMini: `${base}-mini.jpg`, principal: a._count.fotos === 0, ancho: meta.width, alto: meta.height, subidaPorId: u.id },
      });
      await registrar(tx, { usuarioId: u.id, articuloId: id, tipo: "foto", campo: "foto", despues: "foto añadida" });
      return f;
    });
  });
  return Response.json({ ok: true, id: r === "repetida" ? null : r.id });
});
