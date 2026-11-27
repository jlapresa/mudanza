import { defineConfig, devices } from "@playwright/test";

// Cada ejecución usa una base de datos nueva y vacía (nunca se reinicia una existente).
process.env.E2E_DB ??= `mudanza_e2e_${Date.now()}`;
const DB = `postgresql://postgres:postgres@localhost:5432/${process.env.E2E_DB}`;
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  globalSetup: "./e2e/preparar.ts",
  globalTeardown: "./e2e/terminar.ts",
  use: {
    baseURL: "http://localhost:3100",
    launchOptions: { executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" },
  },
  projects: [{ name: "movil", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100/entrar",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: DB,
      DATABASE_URL_UNPOOLED: DB,
      ACCESO_INICIAL: "enlace-inicial-de-prueba-0123456789",
      RESPONSABLES: "jefa@quum.com",
      BLOB_READ_WRITE_TOKEN: "",
      APP_URL: "http://localhost:3100",
      ALMACEN_DIR: "./datos/fotos-test",
      AUTH_DEV_LOGIN: "1",
      NEXT_DIST_DIR: ".next-test",
    },
  },
});
