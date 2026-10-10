import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** true recién en el navegador: evita diferencias con el HTML del servidor
    al leer datos de localStorage (por ejemplo, el carrito). */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
