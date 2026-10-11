// Llamadas a la API del panel. Si el servidor responde con un mensaje de
// error, se lanza un Error con ese mismo texto para mostrárselo a la persona.

export class UnauthorizedError extends Error {}

export async function api<T = unknown>(url: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No hay conexión. Revisá internet y probá de nuevo.");
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // respuesta sin cuerpo
  }

  if (response.status === 401 && url !== "/api/auth") throw new UnauthorizedError("La sesión venció. Volvé a ingresar.");
  if (response.status === 413) throw new Error("El archivo es demasiado pesado.");
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "";
    throw new Error(message || "Algo salió mal. Probá de nuevo.");
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Algo salió mal. Probá de nuevo.";
}

/** Ejecuta una acción masiva en tandas y avisa el avance. */
export async function bulk(ids: string[], payload: Record<string, unknown>, onProgress?: (done: number, total: number) => void) {
  const SIZE = 40;
  for (let i = 0; i < ids.length; i += SIZE) {
    await api("/api/products/bulk", { method: "POST", body: { ...payload, ids: ids.slice(i, i + SIZE) } });
    onProgress?.(Math.min(i + SIZE, ids.length), ids.length);
  }
}
