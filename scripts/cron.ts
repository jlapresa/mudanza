// Ejecuta a mano lo mismo que la tarea diaria de Vercel: correos del mercadillo y copia de la base.
import { tareasProgramadas } from "../src/lib/mercadillo";
import { copiaDiaria } from "../src/lib/copia";
import { db } from "../src/lib/db";
(async () => {
  console.log("Correos:", (await tareasProgramadas()).join(", ") || "ninguno");
  console.log("Copia:", await copiaDiaria());
})().finally(() => db.$disconnect());
