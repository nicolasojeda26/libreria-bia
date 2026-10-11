// Achica y comprime una foto en el navegador antes de subirla, para que
// pese poco y la tienda cargue rápido.

const MAX_SIDE = 1000;
const QUALITY = 0.82;
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(blob);
  });
}

export function compressDataUrl(dataUrl: string, maxSide = MAX_SIDE, quality = QUALITY): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        const ratio = Math.min(maxSide / width, maxSide / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No se pudo procesar la foto."));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("El archivo no es una foto que se pueda abrir."));
    img.src = dataUrl;
  });
}

/** Convierte un archivo de imagen en una foto liviana lista para guardar. */
export async function fileToPhoto(file: Blob): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Ese archivo no es una foto. Usá JPG, PNG o WebP.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("La foto pesa más de 20 MB. Probá con una más chica.");
  return compressDataUrl(await readAsDataUrl(file));
}

/** Copia una foto ya guardada (para duplicar un producto). */
export async function urlToPhoto(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("No se pudo copiar la foto.");
  return fileToPhoto(await response.blob());
}
