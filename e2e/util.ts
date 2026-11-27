import { expect, type Page, type Browser } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient({ datasourceUrl: `postgresql://postgres:postgres@localhost:5432/${process.env.E2E_DB}` });

export async function entrar(page: Page, email: string, nombre: string, rol: "responsable" | "colaborador" | "equipo") {
  await page.goto("/entrar");
  await page.fill("#p-email", email);
  await page.fill("#p-nombre", nombre);
  await page.selectOption("#p-rol", rol);
  await page.getByRole("button", { name: "Entrar sin código" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

export async function nuevaSesion(browser: Browser, email: string, nombre: string, rol: "responsable" | "colaborador" | "equipo") {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await entrar(page, email, nombre, rol);
  return { ctx, page };
}

export async function abrirMercadillo() {
  const ahora = Date.now();
  await db.ajuste.upsert({ where: { clave: "mercadillo_apertura" }, create: { clave: "mercadillo_apertura", valor: new Date(ahora - 86400_000).toISOString() }, update: { valor: new Date(ahora - 86400_000).toISOString() } });
  await db.ajuste.upsert({ where: { clave: "mercadillo_cierre" }, create: { clave: "mercadillo_cierre", valor: new Date(ahora + 5 * 86400_000).toISOString() }, update: { valor: new Date(ahora + 5 * 86400_000).toISOString() } });
}

export { expect };
