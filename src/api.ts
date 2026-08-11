import { nanoid } from 'nanoid';
import type {
  AlbumTemplateDocument,
  ExportHistoryEntry,
  LocalUserProfile,
  Order,
  Shop,
  TemplateSummary
} from '@shared/domain';
import { apiRequest } from './api/httpClient';

const storageKeys = {
  templates: 'album-web-templates',
  templateDocuments: 'album-web-template-documents',
  exports: 'album-web-exports',
  user: 'album-web-user'
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function personalizationValue(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return textValue(value);
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${key}: ${textValue(item)}`)
    .join('\n');
}

function firstValue(record: Record<string, unknown>, ...keys: string[]): unknown {
  return keys.map((key) => record[key]).find((value) => value !== undefined && value !== null);
}

function objectTextValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, textValue(item)])
  );
}

function printImageValue(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('打印接口未返回图片数据。');
  }

  const record = value as Record<string, unknown>;
  const directValue = firstValue(
    record,
    'image_base64',
    'imageBase64',
    'base64',
    'image',
    'print_image',
    'printImage'
  );
  if (typeof directValue === 'string' && directValue.trim()) return directValue.trim();

  const wrappedValue = firstValue(record, 'data', 'result');
  if (wrappedValue !== undefined && wrappedValue !== value) return printImageValue(wrappedValue);

  throw new Error('打印接口未返回图片数据。');
}

function toOrder(value: unknown, index: number): Order {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const id = textValue(firstValue(record, 'id', 'order_id', 'order_number') ?? `order-${index + 1}`);
  const orderNo = textValue(firstValue(record, 'order_number', 'orderNo', 'orderno') ?? id);
  const shop = textValue(firstValue(record, 'shop', 'store'));
  const product = textValue(firstValue(record, 'product', 'product_name'));
  const specifications = textValue(firstValue(record, 'specifications', 'specification', 'size'));
  const customInfo = personalizationValue(firstValue(record, 'personalization', 'customInfo', 'custom_info', 'note'));
  const paymentMethod = textValue(firstValue(record, 'payment_method', 'paymentMethod', 'payment'));
  const shippingAddress = textValue(firstValue(record, 'shipping_address', 'shippingAddress', 'address'));
  const transactionId = textValue(firstValue(record, 'transaction_id', 'transactionId', 'transaction'));
  const quantity = textValue(firstValue(record, 'quantity', 'qty'));
  const price = textValue(firstValue(record, 'price', 'amount'));
  const productInformation = objectTextValues(record.product_information);
  const raw: Record<string, string> = {};

  for (const [key, item] of Object.entries(record)) {
    raw[key] = textValue(item);
  }

  Object.assign(raw, productInformation);

  Object.assign(raw, {
    orderno: orderNo,
    orderid: orderNo,
    shop,
    product,
    specification: specifications,
    custominfo: customInfo,
    paymentmethod: paymentMethod,
    shippingaddress: shippingAddress,
    transactionid: transactionId,
    quantity,
    price
  });

  const parsedQuantity = Number.parseFloat(quantity);
  const item = {
    id: `${id}:1`,
    orderId: id,
    sku: textValue(record.sku),
    productName: product,
    customInfo,
    quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
    raw
  };

  return {
    id,
    orderNo,
    customerName: textValue(firstValue(record, 'customer_name', 'customerName') ?? shop),
    status: textValue(record.status),
    sourceUpdatedAt: textValue(firstValue(record, 'updated_at', 'sourceUpdatedAt')) || undefined,
    productInformation,
    raw,
    items: [item]
  };
}

function normalizeOrders(value: unknown): Order[] {
  let data = value;
  if (value && typeof value === 'object') {
    if ('orders' in value) {
      data = (value as { orders: unknown }).orders;
    } else if ('items' in value) {
      data = (value as { items: unknown }).items;
    } else if ('data' in value) {
      const wrapped = (value as { data: unknown }).data;
      data = wrapped && typeof wrapped === 'object'
        ? 'orders' in wrapped
          ? (wrapped as { orders: unknown }).orders
          : 'items' in wrapped
            ? (wrapped as { items: unknown }).items
            : wrapped
        : wrapped;
    }
  }
  if (!Array.isArray(data)) {
    throw new Error('Invalid orders API response.');
  }
  return data.map(toOrder);
}

function numberValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toShop(value: unknown): Shop {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    id: numberValue(record.id),
    shop: textValue(record.shop),
    shopName: textValue(record.shop_name),
    productCount: numberValue(record.product_count),
    orderCount: numberValue(record.order_count),
    sizeTemplateCount: numberValue(record.size_template_count),
    fontTemplateCount: numberValue(record.font_template_count),
    createdAt: textValue(record.created_at),
    updatedAt: textValue(record.updated_at)
  };
}

function normalizeShops(value: unknown): Shop[] {
  let data = value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    data = record.shops ?? record.items ?? record.data ?? value;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const wrapped = data as Record<string, unknown>;
      data = wrapped.shops ?? wrapped.items ?? data;
    }
  }
  if (!Array.isArray(data)) {
    throw new Error('Invalid shops API response.');
  }
  return data.map(toShop);
}

function defaultUser(): LocalUserProfile {
  return {
    id: 'web-user',
    displayName: '网页用户',
    email: '',
    role: 'designer',
    updatedAt: new Date().toISOString()
  };
}

function saveTemplateDocument(document: AlbumTemplateDocument): TemplateSummary {
  const templates = readStorage<TemplateSummary[]>(storageKeys.templates, []);
  const documents = readStorage<Record<string, AlbumTemplateDocument[]>>(storageKeys.templateDocuments, {});
  const versions = documents[document.id] ?? [];
  const updatedAt = new Date().toISOString();
  const payload = { ...document, updatedAt };
  const summary: TemplateSummary = {
    id: payload.id,
    name: payload.name,
    sourceKind: payload.source.kind,
    sourceOrderId: payload.source.orderId,
    version: versions.length + 1,
    updatedAt
  };
  const nextTemplates = [summary, ...templates.filter((item) => item.id !== summary.id)];
  writeStorage(storageKeys.templates, nextTemplates);
  writeStorage(storageKeys.templateDocuments, { ...documents, [document.id]: [...versions, payload] });
  return summary;
}

export const browserAlbumApi = {
  shops: {
    list: async (): Promise<Shop[]> => normalizeShops(await apiRequest<unknown>({
      method: 'GET',
      url: '/shops'
    }))
  },
  orders: {
    list: async (): Promise<Order[]> => normalizeOrders(await apiRequest<unknown>({
      method: 'GET',
      url: '/orders',
      params: { limit: 50 }
    })),
    printImage: async (order: Pick<Order, 'id' | 'orderNo'>): Promise<string> => printImageValue(
      await apiRequest<unknown>({
        method: 'POST',
        url: '/orders/print-image',
        data: {
          order_id: order.id,
          order_number: order.orderNo
        }
      })
    )
  },
  templates: {
    list: async (): Promise<TemplateSummary[]> => readStorage(storageKeys.templates, []),
    getLatest: async (templateId: string): Promise<AlbumTemplateDocument | undefined> => {
      const documents = readStorage<Record<string, AlbumTemplateDocument[]>>(storageKeys.templateDocuments, {});
      return documents[templateId]?.at(-1);
    },
    save: async (document: AlbumTemplateDocument): Promise<TemplateSummary> => saveTemplateDocument(document),
    newDraft: async (name: string): Promise<AlbumTemplateDocument> => {
      const now = new Date().toISOString();
      return {
        schemaVersion: '1.0',
        id: crypto.randomUUID(),
        name,
        source: { kind: 'manual' },
        pages: [{ id: crypto.randomUUID(), name: 'Page 1', width: 1200, height: 800, dpi: 300, fabricJson: { version: '6.0.0', objects: [] }, bindings: [] }],
        createdAt: now,
        updatedAt: now
      };
    }
  },
  exports: {
    list: async (): Promise<ExportHistoryEntry[]> => readStorage(storageKeys.exports, []),
    create: async (input: Omit<ExportHistoryEntry, 'id' | 'createdAt'>): Promise<ExportHistoryEntry> => {
      const entry = { ...input, id: nanoid(), createdAt: new Date().toISOString() };
      writeStorage(storageKeys.exports, [entry, ...readStorage<ExportHistoryEntry[]>(storageKeys.exports, [])]);
      return entry;
    }
  },
  user: {
    get: async (): Promise<LocalUserProfile> => readStorage(storageKeys.user, defaultUser()),
    update: async (profile: LocalUserProfile): Promise<LocalUserProfile> => {
      const next = { ...profile, updatedAt: new Date().toISOString() };
      writeStorage(storageKeys.user, next);
      return next;
    }
  }
};

export type BrowserAlbumApi = typeof browserAlbumApi;
