import type { Order } from '@shared/domain';

function objectList(value: unknown): unknown[] {
  return Array.isArray(value)
    ? value.filter((item) => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    : [];
}

export function hasOrderTemplateJson(order: Pick<Order, 'resolvedLayers'>): boolean {
  const document = order.resolvedLayers;
  const nestedLayers = document.layers && typeof document.layers === 'object' && !Array.isArray(document.layers)
    ? document.layers as Record<string, unknown>
    : undefined;

  return objectList(document.objects).length > 0
    || objectList(nestedLayers?.objects).length > 0;
}
