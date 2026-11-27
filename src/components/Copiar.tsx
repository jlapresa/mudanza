"use client";
import { useState } from "react";

export default function Copiar({ texto, etiqueta = "Copiar enlace", clase }: { texto: string; etiqueta?: string; clase?: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button
      type="button"
      className={clase}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
        } catch {
          window.prompt("Copia el enlace:", texto);
        }
        setHecho(true);
        setTimeout(() => setHecho(false), 2000);
      }}
    >
      <span aria-live="polite">{hecho ? "Copiado" : etiqueta}</span>
    </button>
  );
}
