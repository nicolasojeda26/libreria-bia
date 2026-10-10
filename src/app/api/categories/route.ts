import { NextResponse } from 'next/server';
import { categoryOptions } from '@/lib/categories';

// Las categorías son fijas: salen del árbol definido en src/lib/categories.ts.
export async function GET() {
  return NextResponse.json(categoryOptions());
}
