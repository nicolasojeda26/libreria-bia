import * as xlsx from "xlsx";
import { unzipSync } from "fflate";
import { compressDataUrl } from "@/lib/image-client";
import type { Product } from "@/types/product";

// Importar y exportar el catálogo en Excel (solo se usa en el panel).

// Detecta el tipo MIME de una imagen por sus primeros bytes
function detectImageMime(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "image/webp";
  return "image/png";
}

// Convierte bytes a base64 en el navegador
function u8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

// Extrae las imágenes incrustadas en un .xlsx y las asigna a cada fila de producto
export async function extractImagesFromWorkbook(arrayBuffer: ArrayBuffer, json: Record<string, unknown>[]): Promise<{ json: Record<string, unknown>[]; extracted: number }> {
  try {
    const files = unzipSync(new Uint8Array(arrayBuffer));

    // 1) Archivos de imagen en xl/media/*
    const media: Record<string, Uint8Array> = {};
    Object.entries(files).forEach(([name, data]) => {
      const m = name.match(/xl\/media\/([^/]+)$/);
      if (m) media[m[1]] = data;
    });
    if (Object.keys(media).length === 0) return { json, extracted: 0 };

    const decoder = new TextDecoder();
    const parser = new DOMParser();

    // 2) Relaciones de la primera hoja: rId -> drawing
    const sheetRelPath = "xl/worksheets/_rels/sheet1.xml.rels";
    const sheetRels = files[sheetRelPath];
    if (!sheetRels) return { json, extracted: 0 };

    const relDoc = parser.parseFromString(decoder.decode(sheetRels), "application/xml");
    const drawingTargets: string[] = [];
    relDoc.querySelectorAll("Relationship").forEach((rel) => {
      const target = rel.getAttribute("Target") || "";
      if (target.includes("drawing")) drawingTargets.push(target);
    });

    let extracted = 0;

    for (const target of drawingTargets) {
      const drawingPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
      const drawing = files[drawingPath];
      if (!drawing) continue;

      // Relaciones del drawing: rId -> imagen en media
      const drawingRelsPath = drawingPath.replace(/\/drawings\/([^/]+)$/, "/drawings/_rels/$1.rels");
      const drawingRels = files[drawingRelsPath];
      const imgByRel: Record<string, string> = {};
      if (drawingRels) {
        const drelDoc = parser.parseFromString(decoder.decode(drawingRels), "application/xml");
        drelDoc.querySelectorAll("Relationship").forEach((rel) => {
          imgByRel[rel.getAttribute("Id") || ""] = rel.getAttribute("Target") || "";
        });
      }

      const drawDoc = parser.parseFromString(decoder.decode(drawing), "application/xml");

      // 3) Cada ancla (twoCellAnchor / oneCellAnchor) tiene fila/columna + blip con imagen
      const anchors = drawDoc.querySelectorAll("xdr|twoCellAnchor, xdr|oneCellAnchor, xdr|absoluteAnchor");
      for (const anchor of Array.from(anchors)) {
        const from = anchor.querySelector("xdr|from");
        const blip = anchor.querySelector("a|blip");
        if (!from || !blip) continue;

        const rowEl = from.querySelector("xdr|row");
        if (!rowEl) continue;
        const row = parseInt(rowEl.textContent || "0", 10);
        const embed = blip.getAttribute("r:embed") || blip.getAttribute("r:id") || "";

        const imgTarget = imgByRel[embed];
        if (!imgTarget) continue;
        const imgName = imgTarget.split("/").pop() || "";
        const imgData = media[imgName];
        if (!imgData) continue;

        // Fila del Excel (0-based) -> índice en json (restamos la fila de encabezado)
        const jsonIdx = row - 1;
        if (jsonIdx < 0 || jsonIdx >= json.length) continue;

        const currentImage = String(json[jsonIdx].image || "");
        // Solo asignar si no hay URL real o es el placeholder por defecto
        if (!currentImage || currentImage.includes("placeholder")) {
          const mime = detectImageMime(imgData);
          const dataUrl = `data:${mime};base64,${u8ToBase64(imgData)}`;
          json[jsonIdx].image = await compressDataUrl(dataUrl, 900).catch(() => dataUrl);
          extracted++;
        }
      }
    }

    return { json, extracted };
  } catch {
    // No es un ZIP válido (por ej. .xls antiguo): no hay imágenes para extraer
    return { json, extracted: 0 };
  }
}


/** Lee la primera hoja de un Excel y devuelve sus filas, con las fotos pegadas en las celdas. */
export async function readWorkbook(file: File): Promise<{ rows: Record<string, unknown>[]; photos: number }> {
  const buffer = await file.arrayBuffer();
  const workbook = xlsx.read(new Uint8Array(buffer), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = xlsx.utils.sheet_to_json(sheet) as Record<string, unknown>[];
  if (json.length === 0) throw new Error("El archivo está vacío.");
  const { json: rows, extracted } = await extractImagesFromWorkbook(buffer, json);
  return { rows, photos: extracted };
}

/** Descarga el catálogo como Excel, con las mismas columnas que acepta la importación. */
export function downloadWorkbook(products: Product[]) {
  const origin = window.location.origin;
  const rows = products.map((product) => ({
    "Código": product.id,
    "Producto": product.name,
    "Descripción": product.description,
    "Categoría": product.category,
    "Precio": product.price,
    "Oferta": product.discountPrice ?? "",
    "Costo": product.cost || "",
    "Stock": product.stock,
    "Colores": (product.attributes?.[0]?.values ?? []).map((item) => `${item.value}: ${item.stock}`).join("; "),
    "Imagen": product.image.startsWith("/") ? origin + product.image : product.image,
  }));
  const sheet = xlsx.utils.json_to_sheet(rows);
  sheet["!cols"] = [{ wch: 14 }, { wch: 42 }, { wch: 40 }, { wch: 36 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 40 }, { wch: 60 }];
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, sheet, "Productos");
  const today = new Date().toISOString().slice(0, 10);
  xlsx.writeFile(book, `libreria-bia-productos-${today}.xlsx`);
}
