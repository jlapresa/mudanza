// Ejecuta a mano lo mismo que la tarea diaria de Vercel: avisos del mercadillo y copia de la base.
import { tareasProgramadas } from "../src/lib/mercadillo";
import { copiaDiaria } from "../src/lib/copia";
import { db } from "../src/lib/db";
(async () => {
  console.log("Avisos:", (await tareasProgramadas()).join(", ") || "ninguno");
  console.log("Copia:", await copiaDiaria());
})().finally(() => db.$disconnect());
