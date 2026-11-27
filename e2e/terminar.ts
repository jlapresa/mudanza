import { execSync } from "child_process";

// Elimina solo la base que creó esta misma ejecución (mudanza_e2e_<marca de tiempo>).
export default async function () {
  const nombre = process.env.E2E_DB!;
  if (!/^mudanza_e2e_\d+$/.test(nombre) || process.env.E2E_CONSERVAR) return;
  execSync(`psql "postgresql://postgres:postgres@localhost:5432/postgres" -c "DROP DATABASE IF EXISTS ${nombre} WITH (FORCE)"`, { stdio: "pipe" });
}
