import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["pdfkit", "sharp", "exceljs"],
  // pdfkit lee sus fuentes del disco; en Vercel hay que incluirlas en la función.
  // y el Word del inventario se incluye para cargarlo con un botón.
  outputFileTracingIncludes: {
    "/api/exportar/[tipo]": ["./node_modules/pdfkit/js/data/**"],
    "/*": ["./inventario/*.docx"],
  },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};
export default config;
