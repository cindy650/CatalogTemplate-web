import type { ProductCategory } from '@shared/domain';

/** Products in this whitelist intentionally bypass the text safe-area validation. */
export function isOathBookProduct(product: Pick<ProductCategory, 'name'>): boolean {
  return product.name.trim().includes('宣誓册');
}
