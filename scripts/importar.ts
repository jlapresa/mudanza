// Uso: npm run importar -- ruta/al/inventario.docx [--vista-previa]
// También se puede importar desde la app: Ajustes › Importar inventario.
import { PrismaClient } from "@prisma/client";
import { interpretar, leerDocx, resumen, guardarInventario } from "../src/lib/importacion";

const db = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const ruta = args.find((a) => !a.startsWith("--"));
  if (!ruta) throw new Error("Indica la ruta del archivo .docx");
  const { lineas, desconocidos } = interpretar(await leerDocx(ruta));
  const { salas, unidades } = resumen(lineas);
  console.log(`${lineas.length} líneas · ${unidades} unidades · ${salas.size} salas`);
  for (const s of salas.values()) console.log(`  ${s.planta.padEnd(16)} ${s.sala.padEnd(28)} ${s.lineas}`);
  if (desconocidos.length) console.log("Párrafos fuera de una sala (no se importan):", desconocidos);
  for (const l of lineas) if (l.avisos.length) console.log(`  aviso · ${l.sala} #${l.posicion} «${l.original.trim()}»: ${l.avisos.join("; ")}`);
  if (args.includes("--vista-previa")) return;
  const r = await guardarInventario(db, lineas, ruta.split("/").pop()!);
  console.log(`Importados ${r.nuevos} nuevos, ${r.existentes} ya estaban. Líneas del inventario en la app: ${r.total} (archivo: ${lineas.length}).`);
}

main().finally(() => db.$disconnect());
