"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pendientes, procesarCola } from "@/lib/cola";

export default function EstadoCola() {
  const [n, setN] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const router = useRouter();
  useEffect(() => {
    pendientes().then(setN);
    setOnline(navigator.onLine);
    const alCola = (e: Event) => setN((e as CustomEvent).detail);
    const alError = (e: Event) => setError((e as CustomEvent).detail);
    const alVaciar = () => router.refresh();
    const on = () => { setOnline(true); procesarCola(); };
    const off = () => setOnline(false);
    window.addEventListener("cola", alCola);
    window.addEventListener("cola-error", alError);
    window.addEventListener("cola-vaciada", alVaciar);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    procesarCola();
    const t = setInterval(() => navigator.onLine && procesarCola(), 20000);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("cola", alCola);
      window.removeEventListener("cola-error", alError);
      window.removeEventListener("cola-vaciada", alVaciar);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(t);
    };
  }, [router]);
  if (error)
    return (
      <div className="cola" role="alert" onClick={() => setError(null)}>
        {error} (toca para cerrar)
      </div>
    );
  if (!n && online) return null;
  return (
    <div className="cola" role="status" aria-live="polite">
      {!online ? "Sin conexión. " : ""}
      {n ? `${n} ${n === 1 ? "cambio pendiente" : "cambios pendientes"} de enviar` : "Los cambios se guardarán al volver la conexión"}
    </div>
  );
}
