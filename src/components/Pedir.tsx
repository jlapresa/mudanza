"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { enviar } from "@/lib/cola";

export default function Pedir({ articuloId, nombre, max, miPeticion, abierto }: {
  articuloId: string; nombre: string; max: number; abierto: boolean;
  miPeticion: { id: string; estado: string; cantidad: number } | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState(false);
  const [cantidad, setCantidad] = useState(1);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function ir(url: string, json: unknown) {
    setOcupado(true);
    setError(null);
    const r = await enviar({ url, metodo: "POST", json, descripcion: nombre });
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setForm(false);
    router.refresh();
  }

  if (miPeticion?.estado === "abierta")
    return (
      <div>
        <p className="ok-banda" style={{ margin: "4px 0" }}>Lo has pedido ({miPeticion.cantidad}).</p>
        <button type="button" onClick={() => ir(`/api/peticiones/${miPeticion.id}/retirar`, {})} disabled={ocupado}>Retirar petición</button>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    );
  if (miPeticion?.estado === "asignada" || miPeticion?.estado === "recogida")
    return <p className="ok-banda" style={{ margin: "4px 0" }}>Es para ti.</p>;
  if (!abierto) return null;
  if (!form)
    return <button type="button" className="primario" onClick={() => setForm(true)} aria-label={`Lo quiero: ${nombre}`}>Lo quiero</button>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); ir(`/api/articulos/${articuloId}/peticiones`, { cantidad, comentario }); }}>
      {max > 1 && (
        <div className="campo">
          <label htmlFor={`cant-${articuloId}`}>¿Cuántas unidades? (hay {max})</label>
          <input id={`cant-${articuloId}`} type="number" min={1} max={max} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
        </div>
      )}
      <div className="campo">
        <label htmlFor={`com-${articuloId}`}>Comentario (opcional)</label>
        <input id={`com-${articuloId}`} value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={500} />
      </div>
      <div className="fila">
        <button className="primario" disabled={ocupado}>Pedirlo</button>
        <button type="button" onClick={() => setForm(false)}>Cancelar</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
