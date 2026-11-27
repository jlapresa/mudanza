import path from "path";
import { promises as fs } from "fs";
import { db } from "./db";
import { interpretar, leerDocx, guardarInventario } from "./importacion";

// El Word del inventario va en el repositorio (inventario/). Se puede cargar con un botón,
// sin tener que subirlo. Importar es repetible: no duplica lo que ya esté.
export const ARCHIVO_INCLUIDO = "INVENTARIO_QUUM_MUDANZA.docx";

export async function importarIncluido(usuarioId: string) {
  const ruta = path.join(process.cwd(), "inventario", ARCHIVO_INCLUIDO);
  const buf = await fs.readFile(ruta);
  return guardarInventario(db, interpretar(await leerDocx(buf)).lineas, ARCHIVO_INCLUIDO, usuarioId);
}
