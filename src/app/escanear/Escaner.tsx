"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";

export function codigoDesde(texto: string): string | null {
  const m = texto.match(/\/a\/([A-Z]{2}-\d{4}(?:-[A-Z])?)/i) ?? texto.trim().match(/^([A-Z]{2}-\d{4}(?:-[A-Z])?)$/i);
  return m ? m[1].toUpperCase() : null;
}

export default function Escaner() {
  const video = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const [estado, setEstado] = useState("Abriendo la cámara…");
  const [manual, setManual] = useState("");

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let parar = false;
    let raf = 0;
    const Detector = (window as any).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;

    async function bucle() {
      if (parar) return;
      const v = video.current, c = lienzo.current;
      if (v && c && v.readyState >= 2) {
        let texto: string | null = null;
        try {
          if (detector) {
            const r = await detector.detect(v);
            texto = r[0]?.rawValue ?? null;
          } else {
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            const ctx = c.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, c.width, c.height);
            texto = jsQR(img.data, img.width, img.height)?.data ?? null;
          }
        } catch { /* fotograma ilegible */ }
        const cod = texto ? codigoDesde(texto) : null;
        if (cod) {
          setEstado(`Abriendo ${cod}…`);
          parar = true;
          if (navigator.vibrate) navigator.vibrate(60);
          router.push(`/a/${cod}`);
          return;
        }
        if (texto) setEstado("Ese QR no es de una etiqueta de la mudanza.");
      }
      raf = requestAnimationFrame(() => setTimeout(bucle, 120));
    }

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        flujo = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play();
        }
        setEstado("Buscando un código QR…");
        bucle();
      })
      .catch(() => setEstado("No se puede usar la cámara. Escribe el código de la etiqueta."));
    return () => {
      parar = true;
      cancelAnimationFrame(raf);
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  return (
    <>
      <div style={{ aspectRatio: "1", background: "#000", borderRadius: 12, overflow: "hidden" }}>
        <video ref={video} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} aria-label="Vista de la cámara" />
      </div>
      <canvas ref={lienzo} hidden />
      <p role="status" aria-live="polite">{estado}</p>
      <form className="fila" onSubmit={(e) => { e.preventDefault(); const c = codigoDesde(manual); if (c) router.push(`/a/${c}`); else setEstado("Código no válido. Ejemplo: QM-0053"); }}>
        <label htmlFor="cod" className="visualmente-oculto">Código</label>
        <input id="cod" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="QM-0053" style={{ flex: 1 }} autoCapitalize="characters" />
        <button>Abrir</button>
      </form>
    </>
  );
}
