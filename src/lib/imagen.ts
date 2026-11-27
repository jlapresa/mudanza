"use client";
/** Reduce la foto en el navegador (lado largo máximo de 1600 px) antes de subirla. */
export async function comprimir(file: File, max = 1600): Promise<{ grande: Blob; ancho: number; alto: number }> {
  let fuente: ImageBitmap | HTMLImageElement;
  try {
    fuente = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    fuente = await new Promise<HTMLImageElement>((ok, mal) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = mal;
      img.src = URL.createObjectURL(file);
    });
  }
  const w0 = "naturalWidth" in fuente ? fuente.naturalWidth : fuente.width;
  const h0 = "naturalHeight" in fuente ? fuente.naturalHeight : fuente.height;
  const k = Math.min(1, max / Math.max(w0, h0));
  const ancho = Math.round(w0 * k);
  const alto = Math.round(h0 * k);
  const c = document.createElement("canvas");
  c.width = ancho;
  c.height = alto;
  c.getContext("2d")!.drawImage(fuente, 0, 0, ancho, alto);
  const grande = await new Promise<Blob>((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error("toBlob"))), "image/jpeg", 0.82));
  return { grande, ancho, alto };
}
