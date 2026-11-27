"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { enviar } from "@/lib/cola";

export default function Accion({ url, json, texto, clase, confirmar }: { url: string; json?: unknown; texto: string; clase?: string; confirmar?: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={clase} disabled={ocupado} onClick={async () => {
        if (confirmar && !confirm(confirmar)) return;
        setOcupado(true);
        setError(null);
        const r = await enviar({ url, metodo: "POST", json: json ?? {}, descripcion: texto });
        setOcupado(false);
        if (!r.ok) setError(r.error);
        router.refresh();
      }}>{texto}</button>
      {error && <span className="error" role="alert"> {error}</span>}
    </>
  );
}
