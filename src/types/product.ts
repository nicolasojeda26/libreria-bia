export interface ProductAttributeValue {
  value: string;
  stock: number;
  price: number;
}

export interface ProductAttribute {
  name: string;
  values: ProductAttributeValue[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  cost: number;
  discountPrice?: number;
  stock: number;
  category: string;
  image: string;
  attributes?: ProductAttribute[];
}

/** Lo mínimo que necesita una tarjeta de producto en la tienda. */
export interface ProductCardData {
  id: string;
  name: string;
  price: number;
  discountPrice?: number;
  stock: number;
  image: string;
  hasVariants: boolean;
}

/** Producto sin el costo, que es un dato interno del panel. */
export type PublicProduct = Omit<Product, "cost">;

export function toPublicProduct(product: Product): PublicProduct {
  const copy: Partial<Product> = { ...product };
  delete copy.cost;
  return copy as PublicProduct;
}
