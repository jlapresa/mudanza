import { promises as fs } from "fs";
import path from "path";

// Almacenamiento privado de fotos y copias.
// En Vercel: Vercel Blob con acceso privado (BLOB_READ_WRITE_TOKEN).
// En local: una carpeta fuera de /public (ALMACEN_DIR).
// En ambos casos las fotos solo se sirven a través de /api/fotos con sesión iniciada.

const usarBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const raiz = () => path.resolve(process.env.ALMACEN_DIR ?? "./datos/fotos");

function ruta(clave: string) {
  const r = raiz();
  const p = path.resolve(r, clave);
  if (!p.startsWith(r + path.sep)) throw new Error("Clave no válida");
  return p;
}

export async function guardar(clave: string, datos: Buffer, tipo = "image/jpeg") {
  if (usarBlob()) {
    const { put } = await import("@vercel/blob");
    await put(clave, datos, { access: "private", contentType: tipo, addRandomSuffix: false, allowOverwrite: true });
    return;
  }
  const p = ruta(clave);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, datos);
}

export async function leer(clave: string): Promise<Buffer | null> {
  if (usarBlob()) {
    const { get } = await import("@vercel/blob");
    try {
      const r = await get(clave, { access: "private" });
      if (!r || r.statusCode !== 200) return null;
      return Buffer.from(await new Response(r.stream).arrayBuffer());
    } catch {
      return null;
    }
  }
  try {
    return await fs.readFile(ruta(clave));
  } catch {
    return null;
  }
}
