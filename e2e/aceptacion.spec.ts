// Criterios de aceptación del punto 13 de los requisitos.
import { test } from "@playwright/test";
import { execSync } from "child_process";
import { writeFileSync, readFileSync } from "fs";
import path from "path";
import sharp from "sharp";
import jsQR from "jsqr";
import { db, entrar, nuevaSesion, abrirMercadillo, expect } from "./util";

const FOTO = path.join(__dirname, "..", "test-results", "foto-prueba.jpg");

test.beforeAll(async () => {
  const buf = await sharp({ create: { width: 3200, height: 2400, channels: 3, background: "#a0643c" } }).jpeg().toBuffer();
  execSync(`mkdir -p ${path.dirname(FOTO)}`);
  writeFileSync(FOTO, buf);
});

test("9. Tras importar, el número de líneas coincide con el archivo (112)", async () => {
  expect(await db.articulo.count({ where: { origenClave: { not: null } } })).toBe(112);
  expect(await db.articulo.count({ where: { decision: { not: "pendiente" } } })).toBe(0);
});

test("1. Recorro una sala en el móvil: foto y «Se lleva · Barrio fachada» sin volver a la lista", async ({ page }) => {
  await entrar(page, "javier@quum.com", "Javier", "responsable");
  const sala = await db.salaOrigen.findFirstOrThrow({ where: { nombre: "Despacho creatividad" } });
  const articulos = await db.articulo.findMany({ where: { salaOrigenId: sala.id }, orderBy: { posicion: "asc" } });
  await page.goto(`/salas/${sala.id}`);
  await page.locator(".tarjeta").first().click();
  await expect(page.locator("#ficha-titulo")).toHaveText(articulos[0].nombre);

  for (let i = 0; i < 3; i++) {
    await expect(page.locator("#ficha-titulo")).toHaveText(articulos[i].nombre);
    await page.locator('input[type="file"]').setInputFiles(FOTO);
    await expect(page.locator('.foto-principal img[src^="/api/fotos/"]')).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Se lleva", exact: true }).click();
    await page.getByRole("button", { name: "Barrio fachada" }).click();
    await expect(page.getByText("Guardado: se lleva a Barrio fachada.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/salas/${sala.id}\\?a=${articulos[i].codigo}$`)); // sin volver a la lista
    await page.getByRole("link", { name: "Siguiente →" }).click();
  }
  const hechos = await db.articulo.findMany({ where: { id: { in: articulos.slice(0, 3).map((a) => a.id) } }, include: { zonaDestino: true, fotos: true } });
  for (const a of hechos) {
    expect(a.decision).toBe("llevar");
    expect(a.zonaDestino?.nombre).toBe("Barrio fachada");
    expect(a.fotos.length).toBe(1);
  }
  // La foto se ha reducido a 1600 px de lado largo y tiene miniatura.
  const f = hechos[0].fotos[0];
  expect(Math.max(f.ancho!, f.alto!)).toBeLessThanOrEqual(1600);
  expect(f.claveMini).toMatch(/-mini\.jpg$/);
});

test("2. No se puede guardar «Se lleva» sin zona ni «No se lleva» sin salida", async ({ page }) => {
  await entrar(page, "javier@quum.com", "Javier", "responsable");
  const a = await db.articulo.findUniqueOrThrow({ where: { codigo: "QM-0001" } });
  await page.goto(`/a/${a.codigo}`);
  await page.getByRole("button", { name: "Se lleva", exact: true }).click();
  await page.getByRole("button", { name: "No se lleva", exact: true }).click();
  await page.waitForTimeout(500);
  expect((await db.articulo.findUniqueOrThrow({ where: { id: a.id } })).decision).toBe("pendiente");

  const r1 = await page.request.post(`/api/articulos/${a.id}/decision`, { data: { decision: "llevar" } });
  expect(r1.status()).toBe(400);
  expect((await r1.json()).error).toContain("zona de destino");
  const r2 = await page.request.post(`/api/articulos/${a.id}/decision`, { data: { decision: "no_llevar" } });
  expect(r2.status()).toBe(400);
  expect((await r2.json()).error).toContain("qué se hace");
  expect((await db.articulo.findUniqueOrThrow({ where: { id: a.id } })).decision).toBe("pendiente");
});

test("3. Una línea de 6 unidades se divide en 4 que se llevan y 2 al mercadillo", async ({ page }) => {
  await entrar(page, "javier@quum.com", "Javier", "responsable");
  const a = await db.articulo.findFirstOrThrow({ where: { nombre: "Bancos comedor", cantidad: 6 } });
  await page.goto(`/a/${a.codigo}`);
  await page.getByText("Dividir unidades").click();
  await page.getByLabel("Unidades a separar").fill("2");
  await page.getByRole("button", { name: "Separar 2 de 6" }).click();
  await expect(page.getByText(`Unidades separadas en ${a.codigo}-B`)).toBeVisible();

  await page.getByRole("button", { name: "Se lleva", exact: true }).click();
  await page.getByRole("button", { name: "Comedor", exact: true }).click();
  await expect(page.getByText("Guardado: se lleva a Comedor.")).toBeVisible();

  await page.goto(`/a/${a.codigo}-B`);
  await expect(page.locator("#ficha-titulo")).toHaveText("Bancos comedor");
  await page.getByRole("button", { name: "No se lleva", exact: true }).click();
  await page.getByRole("button", { name: "Ofrecer al equipo" }).click();
  await expect(page.getByText("Guardado: no se lleva · Ofrecer al equipo.")).toBeVisible();

  const partes = await db.articulo.findMany({ where: { codigo: { startsWith: a.codigo } }, orderBy: { codigo: "asc" } });
  expect(partes.map((p) => [p.codigo, p.cantidad, p.decision, p.salida])).toEqual([
    [a.codigo, 4, "llevar", null],
    [`${a.codigo}-B`, 2, "no_llevar", "ofrecer_equipo"],
  ]);
});

test("4 y 5. El equipo ve solo el mercadillo; tres piden lo mismo, se asigna por orden y los otros dos reciben el rechazo", async ({ page, browser }) => {
  await abrirMercadillo();
  await entrar(page, "javier@quum.com", "Javier", "responsable");
  const silla = await db.articulo.findFirstOrThrow({ where: { nombre: "Silla blanca polipiel Reyes" } });
  await page.goto(`/a/${silla.codigo}`);
  await page.getByRole("button", { name: "No se lleva", exact: true }).click();
  await page.getByRole("button", { name: "Ofrecer al equipo" }).click();
  await expect(page.getByText("Guardado: no se lleva · Ofrecer al equipo.")).toBeVisible();

  const personas = [["ana@quum.com", "Ana"], ["luis@quum.com", "Luis"], ["marta@quum.com", "Marta"]] as const;
  for (const [email, nombre] of personas) {
    const { ctx, page: p } = await nuevaSesion(browser, email, nombre, "equipo");
    await expect(p).toHaveURL(/\/mercadillo$/);
    const nav = p.getByRole("navigation", { name: "Principal" });
    await expect(nav.getByRole("link")).toHaveText(["Mercadillo", "Mis peticiones"]);
    await p.goto("/salas");
    await expect(p).toHaveURL(/\/mercadillo$/);
    const r = await p.request.post(`/api/articulos/${silla.id}/decision`, { data: { decision: "pendiente" } });
    expect(r.status()).toBe(403);

    await p.getByRole("button", { name: `Lo quiero: ${silla.nombre}` }).click();
    await p.getByLabel("Comentario (opcional)").fill(`Para casa de ${nombre}`);
    await p.getByRole("button", { name: "Pedirlo" }).click();
    await expect(p.getByText("Lo has pedido (1).")).toBeVisible();
    await ctx.close();
    await new Promise((r) => setTimeout(r, 50));
  }

  await page.goto("/peticiones");
  await page.getByRole("button", { name: "Asignar por orden de llegada" }).first().click();
  await expect(page.getByText("Asignadas, por recoger (1)")).toBeVisible();

  const ps = await db.peticion.findMany({ where: { articuloId: silla.id }, include: { usuario: true }, orderBy: { creadaEn: "asc" } });
  expect(ps.map((p) => [p.usuario.nombre, p.estado])).toEqual([["Ana", "asignada"], ["Luis", "rechazada"], ["Marta", "rechazada"]]);

  const avisos = await db.aviso.findMany({ where: { usuario: { email: { in: personas.map((p) => p[0]) } } }, include: { usuario: true } });
  expect(avisos.find((a) => a.usuario.nombre === "Ana")?.texto).toContain("es para ti");
  expect(avisos.filter((a) => a.texto.includes("otra persona")).map((a) => a.usuario.nombre).sort()).toEqual(["Luis", "Marta"]);
  const correos = await db.evento.findMany({ where: { tipo: "correo_simulado" } });
  expect(correos.length).toBeGreaterThanOrEqual(3);

  // Ana entra y ve el aviso y su petición asignada.
  const { ctx, page: ana } = await nuevaSesion(browser, "ana@quum.com", "Ana", "equipo");
  await ana.goto("/avisos");
  await expect(ana.getByText(`«${silla.nombre}» es para ti`)).toBeVisible();
  await ana.goto("/mis-peticiones");
  await expect(ana.getByText("Asignada")).toBeVisible();
  await ctx.close();
});

test("6. Las etiquetas llevan un QR que abre la ficha correcta", async ({ page }) => {
  await entrar(page, "javier@quum.com", "Javier", "responsable");
  await page.goto("/etiquetas");
  const primera = page.locator(".et").first();
  await expect(primera.locator(".zona")).toBeVisible();
  const codigo = (await primera.locator(".cod").textContent())!.trim();
  const zona = (await primera.locator(".zona").textContent())!.trim();
  const png = await primera.locator(".qr").screenshot({ scale: "css" });
  const { data, info } = await sharp(png).extend({ top: 20, bottom: 20, left: 20, right: 20, background: "#fff" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const qr = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  expect(qr?.data).toBe(`http://localhost:3100/a/${codigo}`);

  // Una etiqueta por unidad que se lleva.
  const unidades = (await db.articulo.findMany({ where: { decision: "llevar" } })).reduce((s, x) => s + x.cantidad, 0);
  await expect(page.locator(".et")).toHaveCount(unidades);

  await page.goto(new URL(qr!.data).pathname);
  const a = await db.articulo.findUniqueOrThrow({ where: { codigo }, include: { zonaDestino: true } });
  await expect(page.locator("#ficha-titulo")).toHaveText(a.nombre);
  expect(a.zonaDestino?.nombre.toUpperCase()).toBe(zona.toUpperCase());


  // El escáner reconoce el código escrito a mano y abre la ficha.
  await page.goto("/escanear");
  await page.getByPlaceholder("QM-0053").fill(codigo);
  await page.getByRole("button", { name: "Abrir" }).click();
  await expect(page).toHaveURL(new RegExp(`/a/${codigo}$`));
});

test("7. La lista para la mudanza en PDF agrupa por zona e incluye foto y código", async ({ page }) => {
  await entrar(page, "javier@quum.com", "Javier", "responsable");
  const r = await page.request.get("/api/exportar/mudanza.pdf");
  expect(r.headers()["content-type"]).toBe("application/pdf");
  const ruta = path.join(__dirname, "..", "test-results", "mudanza.pdf");
  writeFileSync(ruta, await r.body());
  const texto = execSync(`pdftotext -layout ${ruta} -`).toString();
  const llevar = await db.articulo.findMany({ where: { decision: "llevar" }, include: { zonaDestino: true } });
  for (const a of llevar) expect(texto).toContain(a.codigo);
  expect(texto).toMatch(/Barrio fachada\s+·\s+\d+ unidades/);
  expect(texto).toMatch(/Comedor\s+·\s+4 unidades/);
  // Barrio fachada va antes que Comedor, como en el orden de zonas.
  expect(texto.search(/Barrio fachada\s+·/)).toBeLessThan(texto.search(/Comedor\s+·/));
  const imagenes = execSync(`pdfimages -list ${ruta} | tail -n +3 | wc -l`).toString().trim();
  expect(Number(imagenes)).toBeGreaterThanOrEqual(3); // las fotos subidas en la prueba 1

  for (const t of ["mudanza.xlsx", "salidas.xlsx", "salidas.pdf", "completo.xlsx"]) {
    const x = await page.request.get(`/api/exportar/${t}`);
    expect(x.status(), t).toBe(200);
  }
});

test("8. Cada cambio queda en el historial con usuario y fecha", async ({ page }) => {
  const a = await db.articulo.findFirstOrThrow({ where: { nombre: "Silla blanca polipiel Reyes" } });
  const ev = await db.evento.findMany({ where: { articuloId: a.id }, include: { usuario: true }, orderBy: { creadoEn: "asc" } });
  const tipos = ev.map((e) => `${e.tipo}:${e.campo ?? ""}`);
  expect(tipos).toContain("importacion:");
  expect(tipos).toContain("cambio:decision");
  expect(tipos).toContain("cambio:salida");
  expect(tipos.filter((t) => t === "peticion:nueva")).toHaveLength(3);
  expect(tipos.filter((t) => t === "asignacion:peticion")).toHaveLength(3);
  for (const e of ev.filter((e) => e.tipo !== "importacion")) {
    expect(e.usuario?.nombre).toBeTruthy();
    expect(e.creadoEn).toBeInstanceOf(Date);
  }
  const fotos = await db.evento.count({ where: { tipo: "foto", usuario: { nombre: "Javier" } } });
  expect(fotos).toBeGreaterThanOrEqual(3);

  await entrar(page, "javier@quum.com", "Javier", "responsable");
  await page.goto(`/a/${a.codigo}`);
  await page.getByText(/^Historial/).click();
  await expect(page.locator("details[open] li").filter({ hasText: "Javier" }).first()).toBeVisible();
});

test("Sin conexión: la decisión queda en cola y se envía al volver", async ({ page, context }) => {
  await entrar(page, "javier@quum.com", "Javier", "responsable");
  const a = await db.articulo.findUniqueOrThrow({ where: { codigo: "QM-0002" } });
  await page.goto(`/a/${a.codigo}`);
  await expect(page.locator("#ficha-titulo")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.getByRole("button", { name: "No se lleva", exact: true }).click();
  await page.getByRole("button", { name: "Reciclar" }).click();
  await expect(page.getByText("Se enviará al volver la conexión")).toBeVisible();
  await expect(page.getByText(/cambio pendiente/)).toBeVisible();
  expect((await db.articulo.findUniqueOrThrow({ where: { id: a.id } })).decision).toBe("pendiente");
  await context.setOffline(false);
  await expect.poll(async () => (await db.articulo.findUniqueOrThrow({ where: { id: a.id } })).salida, { timeout: 15_000 }).toBe("reciclar");
});

test("El mercadillo no admite peticiones fuera de plazo", async ({ page }) => {
  await entrar(page, "pepe@quum.com", "Pepe", "equipo");
  const b = await db.articulo.findFirstOrThrow({ where: { decision: "no_llevar", salida: "ofrecer_equipo", nombre: "Bancos comedor" } });
  await db.ajuste.update({ where: { clave: "mercadillo_cierre" }, data: { valor: new Date(Date.now() - 1000).toISOString() } });
  const r = await page.request.post(`/api/articulos/${b.id}/peticiones`, { data: { cantidad: 1 } });
  expect(r.status()).toBe(400);
  expect((await r.json()).error).toContain("plazo");
  await page.goto("/mercadillo");
  await expect(page.getByText(/Cerró el/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Lo quiero/ })).toHaveCount(0);
});

test("Solo entran cuentas del dominio de Quum", async ({ page }) => {
  await page.goto("/entrar");
  await page.fill("#email", "alguien@gmail.com");
  await page.getByRole("button", { name: "Enviarme el código" }).click();
  await expect(page.getByText("Usa tu correo de Quum")).toBeVisible();
  await page.goto("/salas");
  await expect(page).toHaveURL(/entrar/);
});

test("Registro con el correo corporativo y código de un solo uso", async ({ page, context }) => {
  const buzon = path.join(__dirname, "..", "test-results", `correos-${process.env.E2E_DB}`, "correos.jsonl");
  const ultimoCodigo = () => {
    const lineas = readFileSync(buzon, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const m = lineas.filter((c) => c.para[0] === "nueva.persona@quum.com").pop();
    return m.asunto.match(/(\d{6})/)[1] as string;
  };
  await page.goto("/entrar");
  await page.fill("#email", "Nueva.Persona@quum.com");
  await page.fill("#nombre", "Nueva Persona");
  await page.getByRole("button", { name: "Enviarme el código" }).click();
  await expect(page.getByText("Te hemos enviado un código a nueva.persona@quum.com")).toBeVisible();
  const codigo = ultimoCodigo();

  await page.fill("#codigo", codigo === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("El código no es correcto o ha caducado.")).toBeVisible();

  await page.fill("#codigo", codigo);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/mercadillo$/);
  const u = await db.usuario.findUniqueOrThrow({ where: { email: "nueva.persona@quum.com" } });
  expect([u.nombre, u.rol]).toEqual(["Nueva Persona", "equipo"]);

  // El mismo código no vale dos veces.
  await context.clearCookies();
  await page.goto(`/entrar?paso=codigo&email=nueva.persona@quum.com`);
  await page.fill("#codigo", codigo);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("El código no es correcto o ha caducado.")).toBeVisible();
  expect(await db.codigoAcceso.count({ where: { email: "nueva.persona@quum.com" } })).toBe(1);
  const guardado = await db.codigoAcceso.findFirstOrThrow({ where: { email: "nueva.persona@quum.com" } });
  expect(guardado.hash).not.toContain(codigo); // el código no se guarda en claro
});

test.afterAll(async () => {
  await db.$disconnect();
});
