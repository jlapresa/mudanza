"use client";
export default function Imprimir() {
  return <button type="button" className="primario" onClick={() => window.print()}>Imprimir</button>;
}
