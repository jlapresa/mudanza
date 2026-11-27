import { manejar, apiUsuario, ErrorApi } from "@/lib/sesion";
import { excelCompleto, excelGrupos, grupoMudanza, grupoSalidas, pdfGrupos } from "@/lib/exportar";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const GET = manejar(async (_req, { params }) => {
  await apiUsuario("inventario");
  const { tipo } = await params;
  const hoy = new Date().toISOString().slice(0, 10);
  let datos: Buffer, mime: string, nombre: string;
  switch (tipo) {
    case "mudanza.pdf":
      datos = await pdfGrupos("Lista para la mudanza", "Artículos que se llevan, por zona de destino", await grupoMudanza(), false);
      mime = "application/pdf"; nombre = `mudanza-quum-${hoy}.pdf`; break;
    case "mudanza.xlsx":
      datos = await excelGrupos("Mudanza", await grupoMudanza(), false); mime = XLSX; nombre = `mudanza-quum-${hoy}.xlsx`; break;
    case "salidas.pdf":
      datos = await pdfGrupos("Lista de salidas", "Lo que no se lleva, por salida", await grupoSalidas(), true);
      mime = "application/pdf"; nombre = `salidas-quum-${hoy}.pdf`; break;
    case "salidas.xlsx":
      datos = await excelGrupos("Salidas", await grupoSalidas(), true); mime = XLSX; nombre = `salidas-quum-${hoy}.xlsx`; break;
    case "completo.xlsx":
      datos = await excelCompleto(); mime = XLSX; nombre = `inventario-completo-quum-${hoy}.xlsx`; break;
    default:
      throw new ErrorApi(404, "Exportación desconocida.");
  }
  return new Response(new Uint8Array(datos), {
    headers: { "content-type": mime, "content-disposition": `attachment; filename="${nombre}"` },
  });
});
