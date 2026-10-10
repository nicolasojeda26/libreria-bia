import { Product } from "@/types/product";

// Constantes para el entorno
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function getProducts(): Promise<Product[]> {
  // Respaldo opcional: solo se usa si la base está vacía y hay una planilla configurada.
  if (!SHEET_ID) return [];

  try {
    // Usamos el export CSV para obtener datos rápidos de Google Sheets (Requiere que sea público)
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Productos`;
    const res = await fetch(url, { next: { revalidate: 60 } }); // ISR (Vito Store optimization)
    const csvStr = await res.text();
    
    // Parseo muy básico de CSV (Asume comillas dobles y comas estándar sin saltos de linea dentro)
    const lines = csvStr.split('\n');
    const products: Product[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      const values = line.split('","').map(v => v.replace(/(^")|("$)/g, ''));
      if (values.length < 6) continue;

      products.push({
        id: values[0] || i.toString(),
        name: values[1] || "",
        description: values[2] || "",
        price: parseFloat(values[3]) || 0,
        cost: 0,
        stock: parseInt(values[4]) || 0,
        category: values[5] || "",
        image: values[6] || ""
      });
    }

    return products;
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
}
