import { execSync } from "child_process";

// Crea la base de datos de esta ejecución, aplica el esquema e importa el inventario real.
export default async function () {
  const nombre = process.env.E2E_DB!;
  if (!/^mudanza_e2e_\d+$/.test(nombre)) throw new Error("Nombre de base de pruebas no válido");
  const url = `postgresql://postgres:postgres@localhost:5432/${nombre}`;
  execSync(`psql "postgresql://postgres:postgres@localhost:5432/postgres" -c "CREATE DATABASE ${nombre}"`, { stdio: "pipe" });
  const env = { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url };
  execSync("npx prisma db push --skip-generate", { env, stdio: "pipe" });
  execSync("npx tsx scripts/importar.ts inventario/INVENTARIO_QUUM_MUDANZA.docx", { env, stdio: "pipe" });
}
