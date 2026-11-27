import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { usuarioActual, puedeEditar, esResponsable } from "@/lib/sesion";
import { db } from "@/lib/db";
import Menu from "@/components/Menu";
import EstadoCola from "@/components/EstadoCola";

export const metadata: Metadata = {
  title: "Mudanza Quum",
  description: "Inventario y destino de los muebles de la oficina",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icono.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1f4fd1" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await usuarioActual();
  const avisos = u ? await db.aviso.count({ where: { usuarioId: u.id, leido: false } }) : 0;
  const enlaces = !u
    ? []
    : puedeEditar(u)
      ? [
          { href: "/", texto: "Inicio" },
          { href: "/salas", texto: "Salas" },
          { href: "/articulos", texto: "Artículos" },
          { href: "/destinos", texto: "Por destino" },
          { href: "/mercadillo", texto: "Mercadillo" },
          ...(esResponsable(u) ? [{ href: "/peticiones", texto: "Peticiones" }] : []),
          { href: "/escanear", texto: "Escanear" },
          { href: "/exportar", texto: "Listas" },
          ...(esResponsable(u) ? [{ href: "/ajustes", texto: "Ajustes" }] : []),
        ]
      : [
          { href: "/mercadillo", texto: "Mercadillo" },
          { href: "/mis-peticiones", texto: "Mis peticiones" },
        ];
  return (
    <html lang="es">
      <body>
        {u && (
          <header className="cabecera">
            <div className="envoltura">
              <Link href={puedeEditar(u) ? "/" : "/mercadillo"} className="marca">Mudanza Quum</Link>
              <Menu enlaces={enlaces} />
              <Link href="/avisos" className="campana" aria-label={`Avisos${avisos ? `: ${avisos} sin leer` : ""}`}>
                <span aria-hidden>🔔</span>
                {avisos > 0 && <b aria-hidden>{avisos}</b>}
              </Link>
              <Link href="/cuenta" className="usuario" aria-label="Tu cuenta">
                <span aria-hidden>{u.name.split(" ")[0]}</span>
              </Link>
            </div>
          </header>
        )}
        <main className="envoltura">{children}</main>
        <EstadoCola />
      </body>
    </html>
  );
}
