import { nanoid } from 'nanoid';
import type {
  AlbumTemplateDocument,
  AddMountedFontLayoutPayload,
  CatalogSizeOption,
  CatalogSizeOptionFields,
  CatalogSizeTemplate,
  CatalogSizeTemplatePayload,
  InnerPageTemplate,
  InnerPageTemplatePayload,
  InnerPageSizeOption,
  InnerPageSizeOptionUpdatePayload,
  FontLayoutCanvas,
  FontLayoutLibraryPayload,
  FontLayoutLibraryTemplate,
  ExportHistoryEntry,
  FontLibraryItem,
  FontUploadPayload,
  FontUpdatePayload,
  FontLayoutTemplate,
  FontLayoutSyncResult,
  FontLayoutSizeOptionStatus,
  FontLayoutSizeOptionsSyncItem,
  FontLayoutSizeOptionsSyncResult,
  LocalUserProfile,
  Order,
  OrderListFilters,
  OrderListResult,
  OrderStatusDefinition,
  ProductCategory,
  ProductCategoryPayload,
  ProductCommonSpecValue,
  ProductShop,
  Shop,
  ShopPayload,
  SizeTemplateFormData,
  SizeTemplateFormOption,
  SizeTemplateFormSizeData,
  SizeTemplate,
  SizeTemplateOptionPayload,
  SizeTemplatePayload,
  SizeTemplateUnit,
  SizeTemplateUnitValues,
  MountedFontLayout,
  MountedSizeLayout,
  SaveMountedSizeLayoutPayload,
  SyncMountedFontLayoutPayload,
  TemplateImportAnalyzeResult,
  TemplateImportDraft,
  TemplateImportFinalizeResult,
  TemplateSummary,
  TextGenerationRule,
  TextGenerationRulePayload
} from '@shared/domain';
import { normalizeProductSafeDistances } from './shared/safeDistance';
import { apiBaseUrl, apiRequest, httpClient } from './api/httpClient';

const storageKeys = {
  templates: 'album-web-templates',
  templateDocuments: 'album-web-template-documents',
  sizeTemplates: 'album-web-size-templates',
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

function apiFileUrl(value: unknown): string {
  const path = textValue(value).trim();
  if (!path || /^(?:https?:|data:|blob:)/i.test(path) || !apiBaseUrl) return path;
  try {
    return new URL(path, apiBaseUrl).toString();
  } catch {
    return path;
  }
}

function orderStatusValue(value: unknown): Order['status'] {
  const status = typeof value === 'number' ? value : Number.parseInt(textValue(value), 10);
  return Number.isInteger(status) && status >= 0 && status <= 5 ? status : -1;
}

function objectTextValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, textValue(item)])
  );
}

function fieldLabelValues(record: Record<string, unknown>): Record<string, string> {
  const labels: Record<string, string> = {};

  for (const [key, item] of Object.entries(record)) {
    if (!key.endsWith('_text')) continue;
    if (key === 'status_text' || key === 'status_button_text') continue;

    const field = key.slice(0, -'_text'.length);
    const label = textValue(item).trim();
    if (field && label) labels[field] = label;
  }

  return labels;
}

function objectDataAndLabels(value: unknown): {
  labels: Record<string, string>;
  values: Record<string, string>;
} {
  const labels: Record<string, string> = {};
  const values: Record<string, string> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { labels, values };

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key.endsWith('_text')) {
      const field = key.slice(0, -'_text'.length);
      const label = textValue(item).trim();
      if (field && label) labels[field] = label;
    } else {
      values[key] = textValue(item);
    }
  }

  return { labels, values };
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

export type OrderTemplateExportFile = {
  blob: Blob;
  filename: string;
};

function downloadFilename(contentDisposition: unknown, fallback: string): string {
  const value = textValue(contentDisposition).trim();
  const encodedFilename = value.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i)?.[1];
  if (encodedFilename) {
    try {
      return decodeURIComponent(encodedFilename.trim().replace(/^"|"$/g, ''));
    } catch {
      // Fall through to the plain filename form.
    }
  }

  const plainFilename = value.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  return (plainFilename?.[1] || plainFilename?.[2] || fallback).trim();
}

function normalizeOrderStatuses(value: unknown): OrderStatusDefinition[] {
  let data = value;
  if (value && typeof value === 'object' && !Array.isArray(value) && 'data' in value) {
    data = (value as { data: unknown }).data;
  }
  if (!Array.isArray(data)) throw new Error('Invalid order statuses API response.');

  return data.map((item) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      status: numberValue(record.status),
      statusText: textValue(record.status_text),
      statusButtonText: textValue(record.status_button_text)
    };
  });
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
  const fieldLabels = fieldLabelValues(record);
  const productInformationText = objectDataAndLabels(record.product_information);
  const productInformation = productInformationText.values;
  const productInformationLabels = {
    ...productInformationText.labels,
    ...objectTextValues(record.product_information_text)
  };
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
    status: orderStatusValue(record.status),
    statusText: textValue(record.status_text).trim() || '未设置',
    statusButtonText: textValue(record.status_button_text).trim(),
    createdAt: textValue(firstValue(record, 'created_at', 'createdAt')),
    ...(numberValue(firstValue(record, 'shop_id', 'shopId')) > 0
      ? { shopId: numberValue(firstValue(record, 'shop_id', 'shopId')) }
      : {}),
    ...(numberValue(firstValue(record, 'product_id', 'productId')) > 0
      ? { productId: numberValue(firstValue(record, 'product_id', 'productId')) }
      : {}),
    sizeTemplateId: textValue(firstValue(record, 'size_template_id', 'sizeTemplateId')).trim() || undefined,
    matchedTemplate: recordValue(firstValue(record, 'matched_template', 'matchedTemplate')),
    resolvedLayers: recordValue(firstValue(record, 'resolved_layers', 'resolvedLayers', 'template_json', 'templateJson')),
    sourceUpdatedAt: textValue(firstValue(record, 'updated_at', 'sourceUpdatedAt')) || undefined,
    fieldLabels,
    productInformation,
    productInformationLabels,
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

function normalizeOrderList(value: unknown): OrderListResult {
  let data = value;
  if (value && typeof value === 'object' && !Array.isArray(value) && 'data' in value) {
    data = (value as { data: unknown }).data;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid orders API response.');
  }

  const record = data as Record<string, unknown>;
  return {
    items: normalizeOrders(record.items ?? []),
    total: numberValue(record.total),
    limit: numberValue(record.limit) || 20,
    pages: numberValue(record.pages) || 1,
    totalPages: numberValue(record.total_pages)
  };
}

function numberValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toShop(value: unknown): Shop {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const products = Array.isArray(record.products)
    ? record.products.map(textValue).filter(Boolean)
    : [];
  return {
    id: numberValue(record.id),
    shop: textValue(record.shop),
    shopName: textValue(record.shop_name),
    wecomRobotWebhookUrl: textValue(record.wecom_robot_webhook_url ?? record.wecomRobotWebhookUrl),
    products,
    productCount: numberValue(record.product_count),
    orderCount: numberValue(record.order_count),
    newOrderCount: numberValue(record.new_order_count),
    confirmationCount: numberValue(record.confirmation_count),
    pendingProductionCount: numberValue(record.pending_production_count),
    inProductionCount: numberValue(record.in_production_count),
    pendingShipmentCount: numberValue(record.pending_shipment_count),
    completedOrderCount: numberValue(record.completed_order_count),
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

function toProductShop(value: unknown): ProductShop {
  const record = recordValue(value);
  return {
    id: numberValue(record.id),
    shop: textValue(record.shop),
    shopName: textValue(record.shop_name ?? record.shopName)
  };
}

function toProductCommonSpecValue(value: unknown): ProductCommonSpecValue {
  const record = recordValue(value);
  const rawPageCountOptions = record.pageCountOptions ?? record.page_count_options;
  const pageCountOptions = Array.isArray(rawPageCountOptions)
    ? rawPageCountOptions.map(numberValue).filter((count) => count > 0)
    : [];
  const rawUnit = textValue(record.unit ?? record.size_unit).toLowerCase();
  const unit = rawUnit === 'mm' || rawUnit === 'cm' ? rawUnit : 'in';
  const rawSpineWidthMode = textValue(record.spineWidthMode ?? record.spine_width_mode);
  return {
    id: textValue(record.id),
    label: textValue(record.label),
    unit,
    pageCount: numberValue(record.pageCount ?? record.page_count),
    pageCountOptions,
    sideWidth: numberValue(record.sideWidth ?? record.side_width ?? record.single_side_width),
    sideHeight: numberValue(record.sideHeight ?? record.side_height ?? record.single_side_height),
    bleed: numberValue(record.bleed),
    spineWidthMode: rawSpineWidthMode === 'by_page_count' ? 'by_page_count' : 'fixed',
    spineWidth: numberValue(record.spineWidth ?? record.spine_width),
    minSpineWidth: numberValue(record.minSpineWidth ?? record.min_spine_width),
    maxSpineWidth: numberValue(record.maxSpineWidth ?? record.max_spine_width),
    spineBleed: numberValue(record.spineBleed ?? record.spine_bleed),
    paperThickness: numberValue(record.paperThickness ?? record.paper_thickness)
  };
}

function normalizeProductCommonSpecValues(value: unknown): ProductCommonSpecValue[] {
  let raw = value;
  if (typeof raw === 'string' && raw.trim()) {
    try { raw = JSON.parse(raw) as unknown; } catch { raw = []; }
  }
  return Array.isArray(raw) ? raw.map(toProductCommonSpecValue).filter((item) => item.id || item.label) : [];
}

function toProductCategory(value: unknown): ProductCategory {
  const record = recordValue(value);
  const rawShops = Array.isArray(record.shops) ? record.shops : [];
  const shopIds = Array.isArray(record.shop_ids)
    ? record.shop_ids.map(numberValue).filter((id) => id > 0)
    : rawShops.map((shop) => toProductShop(shop).id).filter((id) => id > 0);
  const rawProductNames = record.product_names ?? record.productNames;
  const productNames = Array.isArray(rawProductNames) ? rawProductNames.map(textValue).filter(Boolean) : [];
  const rawSpecifications = record.specifications ?? record.specification ?? record.specifications_json ?? record.specificationsJson;
  let specifications: string[] = [];
  if (Array.isArray(rawSpecifications)) {
    specifications = rawSpecifications.map(textValue).map((item) => item.trim()).filter(Boolean);
  } else if (typeof rawSpecifications === 'string' && rawSpecifications.trim()) {
    try {
      const parsed = JSON.parse(rawSpecifications) as unknown;
      if (Array.isArray(parsed)) specifications = parsed.map(textValue).map((item) => item.trim()).filter(Boolean);
    } catch {
      specifications = [];
    }
  }
  const rawTemplateIds = record.size_template_ids ?? record.sizeTemplateIds;
  const rawCommonSpecValues = record.common_spec_values ?? record['常用规格值'] ?? record.commonSpecValues;
  return {
    id: numberValue(record.id),
    name: textValue(record.name).trim(),
    description: textValue(record.description),
    enabled: record.enabled === undefined ? true : record.enabled !== false && numberValue(record.enabled) !== 0,
    productNames,
    specifications,
    specificationField: textValue(record.specification_field ?? record.specificationField),
    commonSpecValues: normalizeProductCommonSpecValues(rawCommonSpecValues),
    ...normalizeProductSafeDistances(record),
    shopIds,
    shops: rawShops.map(toProductShop).filter((shop) => shop.id > 0),
    sizeTemplateIds: Array.isArray(rawTemplateIds) ? rawTemplateIds.map(numberValue).filter((id) => id > 0) : []
  };
}

function normalizeProducts(value: unknown): ProductCategory[] {
  const unwrapped = unwrapApiData(value);
  if (Array.isArray(unwrapped)) return unwrapped.map(toProductCategory);
  const record = recordValue(unwrapped);
  const items = record.items ?? record.products;
  return Array.isArray(items) ? items.map(toProductCategory) : [];
}

function unwrapApiData(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'data' in value) {
    return (value as { data: unknown }).data;
  }
  return value;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function namedApiValue(value: unknown, key: string): unknown {
  const unwrapped = unwrapApiData(value);
  const record = recordValue(unwrapped);
  return record[key] ?? unwrapped;
}

function toSizeTemplateUnitValues(value: unknown): SizeTemplateUnitValues {
  const record = recordValue(value);
  return {
    single_side_width: numberValue(record.single_side_width),
    single_side_height: numberValue(record.single_side_height),
    bleed: numberValue(record.bleed),
    spine_width: numberValue(record.spine_width),
    spine_bleed: numberValue(record.spine_bleed)
  };
}

function toSizeTemplateFormSizeData(value: unknown): SizeTemplateFormSizeData {
  const record = recordValue(value);
  const pageCountArray = Array.isArray(record.page_count_arr)
    ? record.page_count_arr.map(numberValue).filter((count) => count > 0)
    : [];
  return {
    ...toSizeTemplateUnitValues(record),
    page_count: numberValue(record.page_count),
    page_count_arr: pageCountArray,
    spine_width_mode: record.spine_width_mode === 'by_page_count' ? 'by_page_count' : 'fixed',
    ...(record.spine_width_formula && typeof record.spine_width_formula === 'object'
      ? { spine_width_formula: recordValue(record.spine_width_formula) }
      : {})
  };
}

function toSizeTemplateFormData(value: unknown): SizeTemplateFormData {
  const record = recordValue(namedApiValue(value, 'size_form'));
  const unitOptions = Array.isArray(record.size_unit_options)
    ? record.size_unit_options.map(textValue).filter((unit): unit is SizeTemplateFormData['size_unit'] => (
      unit === 'in' || unit === 'mm' || unit === 'cm'
    ))
    : [];
  const rawSizeOptions = Array.isArray(record.size_options)
    ? record.size_options
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : [];
  const sizeOptions: SizeTemplateFormOption[] = rawSizeOptions.map((item) => {
        const itemUnit = textValue(item.size_unit ?? item.sizeUnit);
        const normalizedUnit: SizeTemplateUnit = itemUnit === 'mm' || itemUnit === 'cm' ? itemUnit : 'in';
        const flatValues = toSizeTemplateUnitValues(item);
        const nestedUnits: Record<SizeTemplateUnit, SizeTemplateUnitValues | null> = {
          in: item.in && typeof item.in === 'object' ? toSizeTemplateUnitValues(item.in) : null,
          mm: item.mm && typeof item.mm === 'object' ? toSizeTemplateUnitValues(item.mm) : null,
          cm: item.cm && typeof item.cm === 'object' ? toSizeTemplateUnitValues(item.cm) : null
        };
        if (!nestedUnits.in && !nestedUnits.mm && !nestedUnits.cm) nestedUnits[normalizedUnit] = flatValues;
        return {
          id: textValue(item.id ?? item.option_id).trim() || undefined,
          value: textValue(item.value),
          label: textValue(item.label || item.value),
          disabled: Boolean(item.disabled),
          size_unit: normalizedUnit,
          page_count: numberValue(item.page_count) || numberValue(record.page_count),
          spine_width_mode: (
            item.spine_width_mode === 'by_page_count'
            || recordValue(item.in).spine_width_mode === 'by_page_count'
            || recordValue(item.mm).spine_width_mode === 'by_page_count'
            || recordValue(item.cm).spine_width_mode === 'by_page_count'
          ) ? 'by_page_count' : 'fixed',
          in: nestedUnits.in,
          mm: nestedUnits.mm,
          cm: nestedUnits.cm
        };
  });
  const sizeUnit = textValue(record.size_unit);
  if (sizeOptions.length === 0 && textValue(record.size_option).trim()) {
    const currentUnit: SizeTemplateUnit = sizeUnit === 'mm' || sizeUnit === 'cm' ? sizeUnit : 'in';
    const currentValues = toSizeTemplateUnitValues(record);
    sizeOptions.push({
      id: textValue(record.size_option).trim(),
      value: textValue(record.size_option).trim(),
      label: textValue(record.size_option).trim(),
      disabled: false,
      size_unit: currentUnit,
      page_count: numberValue(record.page_count),
      spine_width_mode: record.spine_width_mode === 'by_page_count' ? 'by_page_count' : 'fixed',
      in: currentUnit === 'in' ? currentValues : null,
      mm: currentUnit === 'mm' ? currentValues : null,
      cm: currentUnit === 'cm' ? currentValues : null
    });
  }
  return {
    ...toSizeTemplateFormSizeData(record),
    size_option: record.size_option == null ? null : textValue(record.size_option),
    size_unit: (sizeUnit === 'mm' || sizeUnit === 'cm' ? sizeUnit : 'in'),
    size_unit_options: unitOptions.length > 0 ? unitOptions : ['in', 'mm', 'cm'],
    size_options: sizeOptions,
    status: textValue(record.status) || 'ready'
  };
}

function toFontLayoutTemplate(value: unknown, includeDetails = true): FontLayoutTemplate {
  const unwrapped = unwrapApiData(value);
  const root = recordValue(unwrapped);
  const record = recordValue(root.font_template ?? root.fontTemplate ?? root.template ?? unwrapped);
  const sizeTemplateId = numberValue(record.size_template_id ?? record.sizeTemplateId);
  const fontId = numberValue(record.font_id ?? record.fontId);
  const canvas = recordValue(record.canvas);
  const rawOptions = recordValue(record.options);
  const syncedSizeOptionIdsValue = record.synced_size_option_ids ?? record.syncedSizeOptionIds;
  const syncedSizeOptionIds = Array.isArray(syncedSizeOptionIdsValue)
    ? syncedSizeOptionIdsValue.map(textValue).filter(Boolean)
    : undefined;
  const isSyncedValue = record.is_synced ?? record.isSynced;
  const syncRequiredValue = record.sync_required ?? record.syncRequired;
  const canvasWidth = Number(canvas.width);
  const canvasHeight = Number(canvas.height);
  const canvasDpi = Number(canvas.dpi);
  return {
    id: numberValue(record.id),
    shopId: numberValue(record.shop_id ?? record.shopId),
    ...(sizeTemplateId > 0 ? { sizeTemplateId } : {}),
    safeDistance: Math.max(0, numberValue(record.safe_distance ?? record.safeDistance ?? rawOptions.safe_distance)),
    name: textValue(record.name || record.template_name || record.font_name || `字体布局 ${record.id || ''}`).trim(),
    description: textValue(record.description),
    ...(fontId > 0 ? { fontId } : {}),
    fontName: textValue(record.font_name ?? record.fontName),
    createdAt: textValue(record.created_at),
    updatedAt: textValue(record.updated_at),
    ...(textValue(record.size_option).trim() ? { sizeOption: textValue(record.size_option).trim() } : {}),
    ...(canvasWidth > 0 && canvasHeight > 0
      ? {
        canvas: {
          width: numberValue(canvas.width),
          height: numberValue(canvas.height),
          ...(canvasDpi > 0 ? { dpi: canvasDpi } : {})
        }
      }
      : {}),
    ...(syncedSizeOptionIds ? { syncedSizeOptionIds } : {}),
    ...(typeof isSyncedValue === 'boolean' ? { isSynced: isSyncedValue } : {}),
    ...(typeof syncRequiredValue === 'boolean' ? { syncRequired: syncRequiredValue } : {}),
    ...(includeDetails && Array.isArray(record.elements)
      ? { elements: record.elements.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')) }
      : {}),
    ...(includeDetails && record.options && typeof record.options === 'object' && !Array.isArray(record.options)
      ? { options: record.options as Record<string, unknown> }
      : {})
  };
}

function normalizeFontLayoutTemplateList(value: unknown): FontLayoutTemplate[] {
  const data = recordValue(unwrapApiData(value));
  const items = Array.isArray(data.items) ? data.items : Array.isArray(unwrapApiData(value)) ? unwrapApiData(value) as unknown[] : [];
  return items.map((item) => toFontLayoutTemplate(item, false));
}

function toSizeTemplate(value: unknown): SizeTemplate {
  const record = recordValue(namedApiValue(value, 'size_template'));
  const productNames = Array.isArray(record.product_names)
    ? record.product_names.map(textValue).filter(Boolean)
    : [];
  const sizeForm = toSizeTemplateFormData(record.size_form);
  const layoutTemplate = recordValue(record.layout_template ?? record.layoutTemplate);
  const fontLayoutTemplates = Array.isArray(record.font_layout_templates)
    ? record.font_layout_templates.map((item) => toFontLayoutTemplate(item, false))
    : [];
  const rawFontTemplateIds = record.font_layout_template_ids ?? record.font_template_ids;
  const explicitFontTemplateIds = Array.isArray(rawFontTemplateIds)
    ? rawFontTemplateIds.map(numberValue).filter((id) => id > 0)
    : [];
  return {
    id: numberValue(record.id),
    shopId: numberValue(record.shop_id),
    shop: textValue(record.shop),
    shopName: textValue(record.shop_name),
    name: textValue(record.template_name || record.name || productNames[0] || `尺寸模板 ${record.id || ''}`).trim(),
    product: productNames[0] || '',
    products: productNames,
    sizeForm,
    fontLayoutTemplates,
    fontLayoutTemplateIds: explicitFontTemplateIds.length > 0
      ? explicitFontTemplateIds
      : fontLayoutTemplates.map((template) => template.id).filter((id) => id > 0),
    unit: sizeForm.size_unit,
    singleWidth: sizeForm.single_side_width,
    singleHeight: sizeForm.single_side_height,
    spineWidth: sizeForm.spine_width,
    bleed: sizeForm.bleed,
    spineBleed: sizeForm.spine_bleed,
    pages: sizeForm.page_count || 1,
    enabled: true,
    notes: '',
    layoutTemplate: Object.keys(layoutTemplate).length > 0 ? layoutTemplate : undefined,
    createdAt: textValue(record.created_at),
    updatedAt: textValue(record.updated_at)
  };
}

function normalizeSizeTemplateList(value: unknown): SizeTemplate[] {
  const data = recordValue(unwrapApiData(value));
  const items = Array.isArray(data.items) ? data.items : Array.isArray(unwrapApiData(value)) ? unwrapApiData(value) as unknown[] : [];
  return items.map(toSizeTemplate);
}

function listItems(value: unknown): unknown[] {
  const unwrapped = unwrapApiData(value);
  if (Array.isArray(unwrapped)) return unwrapped;
  const record = recordValue(unwrapped);
  return Array.isArray(record.items) ? record.items : [];
}

function normalizeFontLayoutCanvas(value: unknown): FontLayoutCanvas {
  const record = recordValue(value);
  return {
    width: Math.max(1, numberValue(record.width) || 1000),
    height: Math.max(1, numberValue(record.height) || 800),
    ...(numberValue(record.dpi) > 0 ? { dpi: numberValue(record.dpi) } : {})
  };
}

function normalizeLayers(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    : [];
}

function normalizeFontLayoutLayerData(value: unknown) {
  const record = recordValue(value);
  return {
    objects: normalizeLayers(record.objects),
    animations: normalizeLayers(record.animations),
    styles: normalizeLayers(record.styles),
    dataSources: normalizeLayers(record.dataSources ?? record.data_sources),
  };
}

function fontLayoutLayerPayload(value: FontLayoutLibraryPayload['layers']) {
  return value;
}

function normalizeInnerPageSizeOption(value: unknown): InnerPageSizeOption {
  const record = recordValue(value);
  const id = textValue(record.id ?? record.size_option_id ?? record.value).trim();
  const label = textValue(record.label ?? record.name ?? record.id ?? record.value).trim() || id;
  const rawLayers = record.layers ?? record.layer_data ?? {};
  const layers = normalizeFontLayoutLayerData(rawLayers);
  const workarea = layers.objects.find((object) => object.id === 'workarea');
  const rawSizeUnit = textValue(record.size_unit ?? record.sizeUnit ?? workarea?.unit);
  const sizeUnit = rawSizeUnit === 'cm' || rawSizeUnit === 'mm' ? rawSizeUnit : 'in';
  return { id, label, sizeUnit, layers };
}

function normalizeInnerPageTemplate(value: unknown): InnerPageTemplate {
  const record = recordValue(namedApiValue(value, 'inner_page_template'));
  const rawOptions = Array.isArray(record.size_options ?? record.sizeOptions) ? (record.size_options ?? record.sizeOptions) as unknown[] : [];
  return {
    id: numberValue(record.id),
    shopId: numberValue(record.shop_id ?? record.shopId),
    productId: numberValue(record.product_id ?? record.productId),
    name: textValue(record.name ?? record.template_name).trim(),
    description: textValue(record.description).trim(),
    previewImagePath: apiFileUrl(record.preview_image ?? record.previewImage ?? record.preview_image_path ?? record.previewImagePath),
    sizeOptions: rawOptions.map(normalizeInnerPageSizeOption),
    createdAt: textValue(record.created_at ?? record.createdAt),
    updatedAt: textValue(record.updated_at ?? record.updatedAt),
  };
}

function innerPageTemplatePayload(payload: InnerPageTemplatePayload): Record<string, unknown> {
  return {
    ...(payload.shopId !== undefined ? { shop_id: payload.shopId } : {}),
    product_id: payload.productId,
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.previewImagePath !== undefined ? { preview_image: payload.previewImagePath } : {}),
    ...(payload.sizeOptions !== undefined ? {
      size_options: payload.sizeOptions.map((option) => ({
        id: option.id,
        label: option.label,
        size_unit: option.sizeUnit,
        layers: fontLayoutLayerPayload(option.layers),
      }))
    } : {}),
  };
}

function innerPageSizeOptionPayload(payload: InnerPageSizeOption | InnerPageSizeOptionUpdatePayload): Record<string, unknown> {
  return {
    ...('id' in payload ? { id: payload.id } : {}),
    ...(payload.label !== undefined ? { label: payload.label } : {}),
    ...(payload.sizeUnit !== undefined ? { size_unit: payload.sizeUnit } : {}),
    ...(payload.layers !== undefined ? { layers: fontLayoutLayerPayload(payload.layers) } : {}),
  };
}

function normalizeCatalogSizeOption(value: unknown): CatalogSizeOption {
  const record = recordValue(value);
  const nestedFieldsRecord = recordValue(record.fields);
  const fieldsRecord = Object.keys(nestedFieldsRecord).length > 0 ? nestedFieldsRecord : record;
  const unitValuesRecord = recordValue(fieldsRecord.unit_values ?? fieldsRecord.unitValues);
  const normalizeUnitMetric = (key: string): Record<SizeTemplateUnit, number> => {
    const metric = recordValue(unitValuesRecord[key]);
    return { in: numberValue(metric.in), mm: numberValue(metric.mm), cm: numberValue(metric.cm) };
  };
  const hasUnitValues = Object.keys(unitValuesRecord).length > 0;
  const fields: CatalogSizeOptionFields = {
    size_unit: fieldsRecord.size_unit === 'mm' || fieldsRecord.size_unit === 'cm' ? fieldsRecord.size_unit : 'in',
    single_side_width: numberValue(fieldsRecord.single_side_width),
    single_side_height: numberValue(fieldsRecord.single_side_height),
    bleed: numberValue(fieldsRecord.bleed),
    spine_width: numberValue(fieldsRecord.spine_width),
    spine_bleed: numberValue(fieldsRecord.spine_bleed),
    ...(hasUnitValues ? { unit_values: {
      single_side_width: normalizeUnitMetric('single_side_width'),
      single_side_height: normalizeUnitMetric('single_side_height'),
      bleed: normalizeUnitMetric('bleed'),
      spine_width: normalizeUnitMetric('spine_width'),
      spine_bleed: normalizeUnitMetric('spine_bleed')
    } } : {})
  };
  const hasLayers = record.layers !== undefined;
  return {
    id: textValue(record.id ?? record.size_option_id ?? record.value).trim(),
    label: textValue(record.label ?? record.name ?? record.id ?? record.value).trim(),
    fields,
    ...(hasLayers ? { layers: normalizeFontLayoutLayerData(record.layers) } : {})
  };
}

function normalizeMountedSizeLayout(value: unknown): MountedSizeLayout {
  const root = recordValue(value);
  const record = recordValue(root.size_layout ?? root.sizeLayout ?? value);
  return {
    sizeOptionId: textValue(record.size_option_id ?? record.sizeOptionId).trim(),
    layers: normalizeLayers(record.layers),
    canvas: normalizeFontLayoutCanvas(record.canvas)
  };
}

function normalizeMountedFontLayout(value: unknown): MountedFontLayout {
  const root = recordValue(unwrapApiData(value));
  const record = recordValue(root.font_layout ?? root.fontLayout ?? root.layout ?? root);
  const rawSizeLayouts = record.size_layouts ?? record.sizeLayouts;
  const sizeLayouts = Array.isArray(rawSizeLayouts)
    ? rawSizeLayouts.map((item) => normalizeMountedSizeLayout(item))
    : [];
  return {
    id: textValue(record.id ?? record.layout_id ?? record.layoutId).trim(),
    fontLayoutTemplateId: numberValue(record.font_layout_template_id ?? record.fontLayoutTemplateId),
    name: textValue(record.name || `布局 ${record.id || ''}`).trim(),
    previewImage: apiFileUrl(record.preview_image ?? record.previewImage),
    sizeLayouts
  };
}

function mountedFontLayoutsFromResponse(value: unknown): MountedFontLayout[] {
  const unwrapped = unwrapApiData(value);
  const root = recordValue(unwrapped);
  const template = recordValue(root.size_template ?? root.sizeTemplate ?? unwrapped);
  const rawLayouts = template.font_layouts ?? template.fontLayouts ?? root.items ?? root.layouts;
  if (Array.isArray(rawLayouts)) return rawLayouts.map(normalizeMountedFontLayout);

  const direct = normalizeMountedFontLayout(unwrapped);
  return direct.id ? [direct] : [];
}

function normalizeCatalogSizeTemplate(value: unknown): CatalogSizeTemplate {
  const record = recordValue(namedApiValue(value, 'size_template'));
  const rawOptions = Array.isArray(record.size_options) ? record.size_options : [];
  const options = rawOptions.length
    ? rawOptions.map(normalizeCatalogSizeOption)
    : [];
  const selectedOptionId = rawOptions.find((option) => recordValue(option).select === true);
  const fontLayouts = Array.isArray(record.font_layouts)
    ? record.font_layouts.map(normalizeMountedFontLayout)
    : [];
  const products = Array.isArray(record.applicable_products)
    ? record.applicable_products.map(textValue).filter(Boolean)
    : Array.isArray(record.product_names)
      ? record.product_names.map(textValue).filter(Boolean)
      : [];
  const pageCountOptions = Array.isArray(record.page_count_options)
    ? record.page_count_options.map(numberValue).filter((count) => count > 0)
    : [];
  const info = Array.isArray(record.size_template_info)
    ? record.size_template_info.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    : [];
  return {
    id: numberValue(record.id),
    ...(numberValue(record.product_id ?? record.productId) > 0 ? { productId: numberValue(record.product_id ?? record.productId) } : {}),
    ...(numberValue(record.selected_font_layout_id ?? record.selectedFontLayoutId) > 0
      ? { selectedFontLayoutId: numberValue(record.selected_font_layout_id ?? record.selectedFontLayoutId) }
      : {}),
    ...(textValue(record.product_category_name ?? record.productCategoryName).trim() ? { productCategoryName: textValue(record.product_category_name ?? record.productCategoryName).trim() } : {}),
    shopId: numberValue(record.shop_id ?? record.shopId),
    shop: textValue(record.shop),
    shopName: textValue(record.shop_name ?? record.shop),
    name: textValue(record.name ?? record.template_name).trim(),
    previewImage: apiFileUrl(record.preview_image ?? record.previewImage),
    applicableProducts: products,
    backgroundColor: textValue(record.background_color ?? record.backgroundColor),
    minSpineWidth: numberValue(record.min_spine_width ?? record.minSpineWidth),
    maxSpineWidth: numberValue(record.max_spine_width ?? record.maxSpineWidth),
    paperThicknessMm: numberValue(record.paper_thickness_mm ?? record.paperThicknessMm),
    spineWidthBasis: numberValue(record.spine_width_basis ?? record.spineWidthBasis) === 1 ? 1 : 0,
    ...normalizeProductSafeDistances(record),
    selectedSizeOptionId: textValue(record.selected_size_option_id ?? record.selectedSizeOptionId).trim()
      || normalizeCatalogSizeOption(selectedOptionId).id
      || options[0]?.id
      || '',
    displayUnit: record.display_unit === 'mm' || record.display_unit === 'cm' ? record.display_unit : 'in',
    pageCount: Math.max(1, numberValue(record.page_count) || 1),
    pageCountOptions,
    sizeOptions: options,
    sizeTemplateInfo: info,
    fontLayouts,
    createdAt: textValue(record.created_at ?? record.createdAt),
    updatedAt: textValue(record.updated_at ?? record.updatedAt)
  };
}

function normalizeFontLayoutLibraryTemplate(value: unknown): FontLayoutLibraryTemplate {
  const record = recordValue(namedApiValue(value, 'font_layout_template'));
  const isCurrentSizeTemplateLayout = record.is_current_size_template_layout ?? record.isCurrentSizeTemplateLayout;
  const layersSource = textValue(record.layers_source ?? record.layersSource);
  const usingBaseLayers = record.using_base_layers ?? record.usingBaseLayers;
  const rawSortKey = textValue(record.sort_key ?? record.sortKey).trim();
  let sortKey = rawSortKey;
  if (rawSortKey.startsWith('"') && rawSortKey.endsWith('"')) {
    try {
      const parsed = JSON.parse(rawSortKey);
      if (typeof parsed === 'string') sortKey = parsed.trim();
    } catch {
      // Keep non-JSON strings unchanged for backwards compatibility.
    }
  }
  return {
    id: numberValue(record.id),
    shopId: numberValue(record.shop_id ?? record.shopId),
    ...(numberValue(record.product_id ?? record.productId) > 0 ? { productId: numberValue(record.product_id ?? record.productId) } : {}),
    ...(textValue(record.product_category_name ?? record.productCategoryName).trim() ? { productCategoryName: textValue(record.product_category_name ?? record.productCategoryName).trim() } : {}),
    name: textValue(record.name ?? record.template_name).trim(),
    sortKey,
    previewImage: apiFileUrl(record.preview_image ?? record.previewImage),
    layers: normalizeFontLayoutLayerData(record.layers),
    ...(typeof isCurrentSizeTemplateLayout === 'boolean'
      ? { isCurrentSizeTemplateLayout }
      : {}),
    ...(layersSource === 'size_template_option' || layersSource === 'size_variant' || layersSource === 'base'
      ? { layersSource: layersSource as 'size_template_option' | 'size_variant' | 'base' }
      : {}),
    ...(typeof usingBaseLayers === 'boolean'
      ? { usingBaseLayers }
      : {}),
    ...(textValue(record.message).trim() ? { message: textValue(record.message) } : {}),
    createdAt: textValue(record.created_at ?? record.createdAt),
    updatedAt: textValue(record.updated_at ?? record.updatedAt)
  };
}

function catalogSizeTemplatePayload(payload: CatalogSizeTemplatePayload): Record<string, unknown> {
  const selectedSizeOptionId = payload.selectedSizeOptionId?.trim();
  return {
    ...(payload.productId !== undefined && payload.productId > 0 ? { product_id: payload.productId } : {}),
    shop_id: payload.shopId,
    name: payload.name,
    preview_image: payload.previewImage,
    background_color: payload.backgroundColor,
    min_spine_width: payload.minSpineWidth,
    max_spine_width: payload.maxSpineWidth,
    paper_thickness_mm: payload.paperThicknessMm,
    spine_width_basis: payload.spineWidthBasis,
    back_cover_safe_distance_json: payload.backCoverSafeDistance,
    cover_safe_distance_json: payload.coverSafeDistance,
    spine_safe_distance_json: payload.spineSafeDistance,
    display_unit: payload.displayUnit,
    page_count: payload.pageCount,
    page_count_options: payload.pageCountOptions,
    selected_size_option_id: selectedSizeOptionId || null,
    size_options: payload.sizeOptions.map((option) => ({
      id: option.id,
      label: option.label,
      select: option.id === selectedSizeOptionId,
      size_unit: option.fields.size_unit,
      single_side_width: option.fields.single_side_width,
      single_side_height: option.fields.single_side_height,
      bleed: option.fields.bleed,
      spine_width: option.fields.spine_width,
      spine_bleed: option.fields.spine_bleed,
      ...(option.layers !== undefined ? { layers: fontLayoutLayerPayload(option.layers) } : {})
    })),
    size_template_info: payload.sizeTemplateInfo
  };
}

function flatSizeOptionPayload(option: SizeTemplateOptionPayload): Record<string, unknown> {
  return {
    id: option.id,
    label: option.label,
    size_unit: option.size_unit,
    single_side_width: option.single_side_width,
    single_side_height: option.single_side_height,
    bleed: option.bleed,
    spine_width: option.spine_width,
    spine_bleed: option.spine_bleed,
    spine_width_mode: option.spine_width_mode,
    ...(option.select !== undefined ? { select: option.select } : {})
  };
}

function sizeTemplatePayload(
  payload: Partial<SizeTemplatePayload>,
  includeSizeOptions = true,
  includeShopId = true
): Record<string, unknown> {
  return {
    ...(includeShopId && payload.shopId !== undefined ? { shop_id: payload.shopId } : {}),
    ...(payload.name !== undefined ? { template_name: payload.name } : {}),
    ...(payload.products !== undefined ? { product_names: payload.products } : {}),
    ...(payload.sizeOption !== undefined ? { size_option: payload.sizeOption } : {}),
    ...(payload.unit !== undefined ? { size_unit: payload.unit } : {}),
    ...(payload.pageCount !== undefined ? { page_count: payload.pageCount } : {}),
    ...(payload.pageCountArr !== undefined ? { page_count_arr: payload.pageCountArr } : {}),
    ...(includeSizeOptions && payload.sizeOptions !== undefined
      ? { size_options: payload.sizeOptions.map(flatSizeOptionPayload) }
      : {})
  };
}

function templateImportResult(value: unknown): TemplateImportAnalyzeResult {
  return unwrapApiData(value) as TemplateImportAnalyzeResult;
}

function normalizeFontList(value: unknown): FontLibraryItem[] {
  const unwrapped = unwrapApiData(value);
  const data = recordValue(unwrapped);
  const items = Array.isArray(unwrapped) ? unwrapped : Array.isArray(data.items) ? data.items : (data.id !== undefined ? [data] : []);
  return items.map((item) => {
    const record = recordValue(item);
    return {
      id: numberValue(record.id),
      shopId: numberValue(record.shop_id ?? record.shopId) || undefined,
      name: textValue(record.font_name),
      family: textValue(record.font_family),
      preferredName: textValue(record.font_preferred),
      englishName: textValue(record.font_en),
      allName: textValue(record.font_all_name),
      postscriptName: textValue(record.post_script_name ?? record.postscript_name),
      filePath: apiFileUrl(firstValue(record, 'file_path', 'file_url', 'oss_url', 'url')),
      enabled: record.enabled !== false && record.enabled !== 0
    };
  });
}

function normalizeFontListPage(value: unknown): { items: FontLibraryItem[]; total: number; limit: number; offset: number } {
  const unwrapped = unwrapApiData(value);
  const data = recordValue(unwrapped);
  const items = normalizeFontList(value);
  return {
    items,
    total: data.total === undefined ? items.length : numberValue(data.total),
    limit: numberValue(data.limit) || items.length,
    offset: numberValue(data.offset)
  };
}

function toTextGenerationRule(value: unknown): TextGenerationRule {
  const record = recordValue(namedApiValue(value, 'text_generation_rule'));
  return {
    id: numberValue(record.id ?? record.rule_id ?? record.ruleId),
    name: textValue(record.name).trim(),
    description: textValue(record.description).trim(),
    createdAt: textValue(record.created_at ?? record.createdAt),
    updatedAt: textValue(record.updated_at ?? record.updatedAt)
  };
}

function normalizeTextGenerationRuleList(value: unknown): { items: TextGenerationRule[]; total: number; limit: number; offset: number } {
  const unwrapped = unwrapApiData(value);
  const record = recordValue(unwrapped);
  const rawItems = Array.isArray(unwrapped)
    ? unwrapped
    : Array.isArray(record.items)
      ? record.items
      : Array.isArray(record.rules)
        ? record.rules
        : [];
  const items = rawItems.map(toTextGenerationRule);
  return {
    items,
    total: record.total === undefined ? items.length : numberValue(record.total),
    limit: numberValue(record.limit) || items.length,
    offset: numberValue(record.offset)
  };
}

function textGenerationRulePayload(payload: TextGenerationRulePayload): Record<string, unknown> {
  return { name: payload.name, description: payload.description };
}

async function listTextGenerationRules({ limit = 20, offset = 0, search }: { limit?: number; offset?: number; search?: string } = {}) {
  return normalizeTextGenerationRuleList(await apiRequest<unknown>({
    method: 'GET',
    url: '/text-generation-rules',
    params: { limit, offset, ...(search?.trim() ? { search: search.trim() } : {}) }
  }));
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
  products: {
    list: async (filters: { search?: string; shopId?: number; limit?: number; offset?: number } = {}): Promise<ProductCategory[]> => normalizeProducts(await apiRequest<unknown>({
      method: 'GET',
      url: '/products',
      params: {
        limit: filters.limit ?? 100,
        offset: filters.offset ?? 0,
        search: filters.search || undefined,
        shop_id: filters.shopId
      }
    })),
    get: async (productId: number): Promise<ProductCategory> => toProductCategory(unwrapApiData(await apiRequest<unknown>({ method: 'GET', url: `/products/${productId}` }))),
    create: async (payload: ProductCategoryPayload): Promise<ProductCategory> => toProductCategory(unwrapApiData(await apiRequest<unknown>({
      method: 'POST',
      url: '/products',
      data: {
        name: payload.name,
        description: payload.description ?? '',
        product_names: payload.productNames,
        specifications: payload.specifications,
        specification_field: payload.specificationField,
        common_spec_values: payload.commonSpecValues ?? [],
        back_cover_safe_distance_json: payload.backCoverSafeDistance,
        cover_safe_distance_json: payload.coverSafeDistance,
        spine_safe_distance_json: payload.spineSafeDistance,
        shop_ids: payload.shopIds,
        enabled: payload.enabled ?? true
      }
    }))),
    update: async (productId: number, payload: Partial<ProductCategoryPayload>): Promise<ProductCategory> => toProductCategory(unwrapApiData(await apiRequest<unknown>({
      method: 'PATCH',
      url: `/products/${productId}`,
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.productNames !== undefined ? { product_names: payload.productNames } : {}),
        ...(payload.specifications !== undefined ? { specifications: payload.specifications } : {}),
        ...(payload.specificationField !== undefined ? { specification_field: payload.specificationField } : {}),
        ...(payload.commonSpecValues !== undefined ? { common_spec_values: payload.commonSpecValues } : {}),
        ...(payload.backCoverSafeDistance !== undefined ? { back_cover_safe_distance_json: payload.backCoverSafeDistance } : {}),
        ...(payload.coverSafeDistance !== undefined ? { cover_safe_distance_json: payload.coverSafeDistance } : {}),
        ...(payload.spineSafeDistance !== undefined ? { spine_safe_distance_json: payload.spineSafeDistance } : {}),
        ...(payload.shopIds !== undefined ? { shop_ids: payload.shopIds } : {}),
        ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {})
      }
    }))),
    delete: async (productId: number): Promise<void> => { await apiRequest<unknown>({ method: 'DELETE', url: `/products/${productId}` }); }
  },
  shops: {
    list: async (): Promise<Shop[]> => normalizeShops(await apiRequest<unknown>({
      method: 'GET',
      url: '/shops'
    })),
    get: async (shopId: number): Promise<Shop> => toShop(unwrapApiData(await apiRequest<unknown>({
      method: 'GET',
      url: `/shops?shop_id=${encodeURIComponent(shopId)}`
    }))),
    create: async (payload: ShopPayload): Promise<Shop> => toShop(await apiRequest<unknown>({
      method: 'POST',
      url: '/shops',
      data: {
        shop: payload.shop,
        shop_name: payload.shopName,
        wecom_robot_webhook_url: payload.wecomRobotWebhookUrl ?? '',
        products: payload.products
      }
    }).then((response) => {
      if (response && typeof response === 'object' && !Array.isArray(response) && 'data' in response) {
        return (response as { data: unknown }).data;
      }
      return response;
    })),
    update: async (shopId: number, payload: ShopPayload): Promise<Shop> => toShop(await apiRequest<unknown>({
      method: 'PATCH',
      url: `/shops/${shopId}`,
      data: {
        shop: payload.shop,
        shop_name: payload.shopName,
        wecom_robot_webhook_url: payload.wecomRobotWebhookUrl ?? '',
        products: payload.products
      }
    }).then((response) => {
      if (response && typeof response === 'object' && !Array.isArray(response) && 'data' in response) {
        return (response as { data: unknown }).data;
      }
      return response;
    })),
    delete: async (shopId: number): Promise<void> => {
      await apiRequest<unknown>({ method: 'DELETE', url: `/shops/${shopId}` });
    }
  },
  orders: {
    list: async (filters: OrderListFilters = {}): Promise<OrderListResult> => normalizeOrderList(await apiRequest<unknown>({
      method: 'GET',
      url: '/orders',
      params: {
        limit: filters.limit ?? 20,
        pages: filters.pages ?? 1,
        order_number: filters.orderNumber || undefined,
        shop: filters.shop || undefined,
        status: filters.status
      }
    })),
    statuses: async (): Promise<OrderStatusDefinition[]> => normalizeOrderStatuses(await apiRequest<unknown>({
      method: 'GET',
      url: '/orders/statuses'
    })),
    saveTemplateJson: async (
      order: Pick<Order, 'id' | 'orderNo'>,
      templateJson: Record<string, unknown>
    ): Promise<void> => {
      await apiRequest<unknown>({
        method: 'PUT',
        url: `/orders/${encodeURIComponent(order.id)}/template-json`,
        data: {
          order_number: order.orderNo,
          template_json: templateJson
        }
      });
    },
    printImage: async (order: Pick<Order, 'id' | 'orderNo'>): Promise<string> => printImageValue(
      await apiRequest<unknown>({
        method: 'POST',
        url: '/orders/print-image',
        data: {
          order_id: order.id,
          order_number: order.orderNo
        }
      })
    ),
    exportTemplate: async (
      order: Pick<Order, 'id' | 'orderNo'>
    ): Promise<OrderTemplateExportFile> => {
      const response = await httpClient.request<Blob>({
        method: 'POST',
        url: '/orders/template-export/download',
        timeout: 120_000,
        responseType: 'blob',
        headers: {
          Accept: 'application/zip, application/octet-stream'
        },
        data: {
          order_id: order.id,
          order_number: order.orderNo
        }
      });
      return {
        blob: response.data,
        filename: downloadFilename(
          response.headers['content-disposition'],
          `${order.orderNo || 'order-template'}.zip`
        )
      };
    },
    sendPreviewImages: async (order: Pick<Order, 'id' | 'orderNo'>): Promise<void> => {
      await apiRequest<unknown>({
        method: 'POST',
        url: '/orders/preview-images/send',
        timeout: 120_000,
        data: {
          order_id: order.id,
          order_number: order.orderNo
        }
      });
    },
    advanceStatus: async (order: Pick<Order, 'id' | 'orderNo'>): Promise<void> => {
      await apiRequest<unknown>({
        method: 'POST',
        url: '/orders/status/advance',
        timeout: 120_000,
        data: {
          order_id: order.id,
          order_number: order.orderNo
        }
      });
    }
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
  sizeTemplates: {
    list: async (
      filters: number | { shopId?: number; limit?: number; offset?: number } = {}
    ): Promise<SizeTemplate[]> => {
      const normalized = typeof filters === 'number' ? { shopId: filters } : filters;
      return normalizeSizeTemplateList(await apiRequest<unknown>({
        method: 'GET',
        url: '/size-templates',
        params: {
          shop_id: normalized.shopId,
          limit: normalized.limit ?? 20,
          offset: normalized.offset ?? 0
        }
      }));
    },
    get: async (templateId: number): Promise<SizeTemplate> => toSizeTemplate(await apiRequest<unknown>({
      method: 'GET',
      url: `/size-templates/${templateId}`
    })),
    form: async (
      templateId: number,
      filters: { sizeOption?: string; unit?: SizeTemplateFormData['size_unit'] } = {}
    ): Promise<SizeTemplateFormData> => toSizeTemplateFormData(await apiRequest<unknown>({
      method: 'GET',
      url: `/size-templates/${templateId}/form`,
      params: {
        size_option: filters.sizeOption,
        size_unit: filters.unit
      }
    })),
    create: async (payload: SizeTemplatePayload): Promise<SizeTemplate> => toSizeTemplate(await apiRequest<unknown>({
      method: 'POST',
      url: '/size-templates',
      data: sizeTemplatePayload(payload)
    })),
    update: async (
      templateId: number,
      payload: Partial<SizeTemplatePayload>
    ): Promise<SizeTemplate> => toSizeTemplate(await apiRequest<unknown>({
      method: 'PATCH',
      url: `/size-templates/${templateId}`,
      data: sizeTemplatePayload(payload, false, false)
    })),
    delete: async (templateId: number): Promise<void> => {
      await apiRequest<unknown>({ method: 'DELETE', url: `/size-templates/${templateId}` });
    },
    options: {
      create: async (templateId: number, payload: SizeTemplateOptionPayload): Promise<void> => {
        await apiRequest<unknown>({
          method: 'POST',
          url: `/size-templates/${templateId}/options`,
          data: payload
        });
      },
      update: async (templateId: number, optionId: string, payload: SizeTemplateOptionPayload): Promise<void> => {
        await apiRequest<unknown>({
          method: 'PATCH',
          url: `/size-templates/${templateId}/options/${encodeURIComponent(optionId)}`,
          data: payload
        });
      },
      delete: async (templateId: number, optionId: string): Promise<void> => {
        await apiRequest<unknown>({
          method: 'DELETE',
          url: `/size-templates/${templateId}/options/${encodeURIComponent(optionId)}`
        });
      }
    }
  },
  catalogSizeTemplates: {
    list: async (filters: { shopId?: number; productId?: number; productName?: string; limit?: number; offset?: number } = {}): Promise<CatalogSizeTemplate[]> => (
      listItems(await apiRequest<unknown>({
        method: 'GET',
        url: '/size-templates',
        params: {
          limit: filters.limit ?? 50,
          offset: filters.offset ?? 0,
          shop_id: filters.shopId,
          product_id: filters.productId,
          product_name: filters.productName
        }
      })).map(normalizeCatalogSizeTemplate)
    ),
    get: async (templateId: number): Promise<CatalogSizeTemplate> => normalizeCatalogSizeTemplate(await apiRequest<unknown>({
      method: 'GET',
      url: `/size-templates/${templateId}`
    })),
    create: async (payload: CatalogSizeTemplatePayload): Promise<CatalogSizeTemplate> => normalizeCatalogSizeTemplate(await apiRequest<unknown>({
      method: 'POST',
      url: '/size-templates',
      data: catalogSizeTemplatePayload(payload)
    })),
    update: async (templateId: number, payload: CatalogSizeTemplatePayload): Promise<CatalogSizeTemplate> => normalizeCatalogSizeTemplate(await apiRequest<unknown>({
      method: 'PATCH',
      url: `/size-templates/${templateId}`,
      data: catalogSizeTemplatePayload(payload)
    })),
    delete: async (templateId: number): Promise<void> => {
      await apiRequest<unknown>({ method: 'DELETE', url: `/size-templates/${templateId}` });
    },
    uploadPreview: async (templateId: number, file: File): Promise<string> => {
      const formData = new FormData();
      formData.append('file', file, file.name);
      const response = await apiRequest<unknown>({
        method: 'PUT',
        url: `/size-templates/${templateId}/preview`,
        data: formData
      });
      const record = recordValue(namedApiValue(response, 'size_template'));
      const previewImage = apiFileUrl(record.preview_image ?? record.previewImage ?? record.url ?? record.file_url);
      if (!previewImage) throw new Error('预览图上传成功，但接口未返回图片地址。');
      return previewImage;
    },
    mountedLayouts: {
      list: async (templateId: number): Promise<MountedFontLayout[]> => mountedFontLayoutsFromResponse(await apiRequest<unknown>({
        method: 'GET',
        url: `/size-templates/${templateId}/font-layouts`
      })),
      add: async (templateId: number, payload: AddMountedFontLayoutPayload): Promise<MountedFontLayout> => {
        await apiRequest<unknown>({
          method: 'POST',
          url: `/size-templates/${templateId}/font-layouts`,
          data: {
            font_layout_template_id: payload.fontLayoutTemplateId,
            source_size_option_id: payload.sourceSizeOptionId,
            name: payload.name
          }
        });
        const layouts = await browserAlbumApi.catalogSizeTemplates.mountedLayouts.list(templateId);
        const layout = layouts.find((item) => item.fontLayoutTemplateId === payload.fontLayoutTemplateId && item.name === payload.name);
        if (!layout) throw new Error('应用字体布局后未查询到布局实例');
        return layout;
      },
      update: async (templateId: number, layoutId: string, payload: Partial<Pick<MountedFontLayout, 'name' | 'previewImage'>> & { sizeLayouts?: MountedSizeLayout[] }): Promise<MountedFontLayout> => {
        await apiRequest<unknown>({
          method: 'PATCH',
          url: `/size-templates/${templateId}/font-layouts/${encodeURIComponent(layoutId)}`,
          data: {
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.previewImage !== undefined ? { preview_image: payload.previewImage } : {}),
            ...(payload.sizeLayouts !== undefined ? { size_layouts: payload.sizeLayouts.map((item) => ({ size_option_id: item.sizeOptionId, layers: item.layers, canvas: item.canvas })) } : {})
          }
        });
        const layout = (await browserAlbumApi.catalogSizeTemplates.mountedLayouts.list(templateId)).find((item) => item.id === layoutId);
        if (!layout) throw new Error('修改后未查询到字体布局实例');
        return layout;
      },
      delete: async (templateId: number, layoutId: string): Promise<void> => {
        await apiRequest<unknown>({ method: 'DELETE', url: `/size-templates/${templateId}/font-layouts/${encodeURIComponent(layoutId)}` });
      },
      saveSize: async (templateId: number, layoutId: string, sizeOptionId: string, payload: SaveMountedSizeLayoutPayload): Promise<MountedSizeLayout> => {
        await apiRequest<unknown>({
          method: 'PUT',
          url: `/size-templates/${templateId}/font-layouts/${encodeURIComponent(layoutId)}/sizes/${encodeURIComponent(sizeOptionId)}`,
          data: { layers: payload.layers, canvas: payload.canvas }
        });
        const layout = (await browserAlbumApi.catalogSizeTemplates.mountedLayouts.list(templateId)).find((item) => item.id === layoutId);
        if (!layout) throw new Error('保存后未查询到字体布局实例');
        const sizeLayout = layout.sizeLayouts.find((item) => item.sizeOptionId === sizeOptionId);
        if (!sizeLayout) throw new Error('接口未返回当前尺寸的字体布局');
        return sizeLayout;
      },
      sync: async (templateId: number, layoutId: string, payload: SyncMountedFontLayoutPayload): Promise<MountedFontLayout> => {
        await apiRequest<unknown>({
          method: 'POST',
          url: `/size-templates/${templateId}/font-layouts/${encodeURIComponent(layoutId)}/sync`,
          data: {
            source_size_option_id: payload.sourceSizeOptionId,
            target_size_option_ids: payload.targetSizeOptionIds,
            mode: payload.mode
          }
        });
        const layout = (await browserAlbumApi.catalogSizeTemplates.mountedLayouts.list(templateId)).find((item) => item.id === layoutId);
        if (!layout) throw new Error('同步后未查询到字体布局实例');
        return layout;
      }
    }
  },
  innerPageTemplates: {
    list: async (filters: { shopId?: number; productId?: number; limit?: number; offset?: number } = {}): Promise<InnerPageTemplate[]> => (
      listItems(await apiRequest<unknown>({
        method: 'GET',
        url: '/inner-page-templates',
        params: {
          limit: filters.limit ?? 50,
          offset: filters.offset ?? 0,
          shop_id: filters.shopId,
          product_id: filters.productId,
        }
      })).map(normalizeInnerPageTemplate)
    ),
    get: async (templateId: number): Promise<InnerPageTemplate> => normalizeInnerPageTemplate(await apiRequest<unknown>({
      method: 'GET',
      url: `/inner-page-templates/${templateId}`
    })),
    create: async (payload: InnerPageTemplatePayload): Promise<InnerPageTemplate> => normalizeInnerPageTemplate(await apiRequest<unknown>({
      method: 'POST',
      url: '/inner-page-templates',
      data: innerPageTemplatePayload(payload)
    })),
    update: async (templateId: number, payload: InnerPageTemplatePayload): Promise<InnerPageTemplate> => normalizeInnerPageTemplate(await apiRequest<unknown>({
      method: 'PATCH',
      url: `/inner-page-templates/${templateId}`,
      data: innerPageTemplatePayload(payload)
    })),
    delete: async (templateId: number): Promise<void> => {
      await apiRequest<unknown>({ method: 'DELETE', url: `/inner-page-templates/${templateId}` });
    },
    sizeOptions: {
      create: async (templateId: number, payload: InnerPageSizeOption): Promise<void> => {
        await apiRequest<unknown>({
          method: 'POST',
          url: `/inner-page-templates/${templateId}/size-options`,
          data: innerPageSizeOptionPayload(payload),
        });
      },
      update: async (templateId: number, sizeOptionId: string, payload: InnerPageSizeOptionUpdatePayload): Promise<void> => {
        await apiRequest<unknown>({
          method: 'PATCH',
          url: `/inner-page-templates/${templateId}/size-options/${encodeURIComponent(sizeOptionId)}`,
          data: innerPageSizeOptionPayload(payload),
        });
      },
      delete: async (templateId: number, sizeOptionId: string): Promise<void> => {
        await apiRequest<unknown>({
          method: 'DELETE',
          url: `/inner-page-templates/${templateId}/size-options/${encodeURIComponent(sizeOptionId)}`,
        });
      },
    },
    uploadPreview: async (templateId: number, file: File): Promise<string> => {
      const formData = new FormData();
      formData.append('file', file, file.name);
      const response = await apiRequest<unknown>({
        method: 'PUT',
        url: `/inner-page-templates/${templateId}/preview`,
        data: formData,
        timeout: 120_000
      });
      if (typeof response === 'string' && response.trim()) return apiFileUrl(response);
      const record = recordValue(unwrapApiData(response));
      const unwrapped = unwrapApiData(response);
      const value = firstValue(record, 'preview_image_path', 'previewImagePath', 'oss_url', 'file_url', 'url', 'path')
        ?? (typeof unwrapped === 'string' ? unwrapped : undefined)
        ?? firstValue(recordValue(unwrapped), 'preview_image_path', 'previewImagePath', 'oss_url', 'file_url', 'url', 'path');
      const path = apiFileUrl(value);
      if (!path) throw new Error('图片上传成功，但接口未返回 OSS 地址。');
      return path;
    }
  },
  oss: {
    uploadImage: async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append('file', file, file.name);
      const response = await apiRequest<unknown>({
        method: 'POST',
        url: '/uploads/images',
        data: formData,
        timeout: 120_000
      });
      if (typeof response === 'string' && response.trim()) return apiFileUrl(response);
      const unwrapped = unwrapApiData(response);
      const record = recordValue(unwrapped);
      const value = firstValue(record, 'url', 'oss_url', 'file_url', 'path');
      const path = apiFileUrl(value);
      if (!path) throw new Error('图片上传成功，但接口未返回 OSS 地址。');
      return path;
    }
  },
  fontLayoutLibrary: {
    list: async (filters: { shopId?: number; productId?: number; search?: string; limit?: number; offset?: number } = {}): Promise<FontLayoutLibraryTemplate[]> => (
      listItems(await apiRequest<unknown>({
        method: 'GET',
        url: '/font-layout-templates',
        params: {
          limit: filters.limit ?? 100,
          offset: filters.offset ?? 0,
          shop_id: filters.shopId,
          product_id: filters.productId,
          search: filters.search
        }
      })).map((item) => normalizeFontLayoutLibraryTemplate(item))
    ),
    get: async (templateId: number, options: { sizeTemplateId?: number; sizeOptionId?: string } = {}): Promise<FontLayoutLibraryTemplate> => normalizeFontLayoutLibraryTemplate(await apiRequest<unknown>({
      method: 'GET',
      url: `/font-layout-templates/${templateId}`,
      params: {
        size_template_id: options.sizeTemplateId,
        size_option_id: options.sizeOptionId
      }
    })),
    create: async (payload: FontLayoutLibraryPayload): Promise<FontLayoutLibraryTemplate> => normalizeFontLayoutLibraryTemplate(await apiRequest<unknown>({
      method: 'POST',
      url: '/font-layout-templates',
      data: {
        shop_id: payload.shopId,
        ...(payload.productId !== undefined ? { product_id: payload.productId } : {}),
        name: payload.name,
        sort_key: payload.sortKey,
        layers: fontLayoutLayerPayload(payload.layers)
      }
    })),
    update: async (templateId: number, payload: Partial<FontLayoutLibraryPayload>): Promise<FontLayoutLibraryTemplate> => normalizeFontLayoutLibraryTemplate(await apiRequest<unknown>({
      method: 'PATCH',
      url: `/font-layout-templates/${templateId}`,
      data: {
        ...(payload.shopId !== undefined ? { shop_id: payload.shopId } : {}),
        ...(payload.productId !== undefined ? { product_id: payload.productId } : {}),
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.sortKey !== undefined ? { sort_key: payload.sortKey } : {}),
        ...(payload.layers !== undefined ? { layers: fontLayoutLayerPayload(payload.layers) } : {})
      }
    })),
    delete: async (templateId: number): Promise<void> => {
      await apiRequest<unknown>({ method: 'DELETE', url: `/font-layout-templates/${templateId}` });
    },
    uploadPreview: async (templateId: number, file: File): Promise<FontLayoutLibraryTemplate> => {
      const formData = new FormData();
      formData.append('file', file, file.name);
      return normalizeFontLayoutLibraryTemplate(await apiRequest<unknown>({
        method: 'PUT',
        url: `/font-layout-templates/${templateId}/preview`,
        data: formData
      }));
    },
    sizeOptions: async (templateId: number, sizeTemplateId: number): Promise<FontLayoutSizeOptionStatus[]> => {
      const response = unwrapApiData(await apiRequest<unknown>({
        method: 'GET',
        url: `/font-layout-templates/${templateId}/size-options`,
        params: { size_template_id: sizeTemplateId }
      }));
      const root = recordValue(response);
      const items = Array.isArray(response)
        ? response
        : Array.isArray(root.items)
          ? root.items
          : Array.isArray(root.size_options)
            ? root.size_options
            : [];
      return items.map((item) => {
        const record = recordValue(item);
        const source = textValue(record.layers_source ?? record.layersSource);
        const hasVariant = record.has_size_variant ?? record.hasSizeVariant;
        const usingBase = record.using_base_layers ?? record.usingBaseLayers;
        return {
          sizeOptionId: textValue(record.size_option_id ?? record.sizeOptionId ?? record.id),
          ...(textValue(record.label).trim() ? { label: textValue(record.label) } : {}),
          ...(typeof hasVariant === 'boolean' ? { hasSizeVariant: hasVariant } : {}),
          ...(source === 'size_template_option' || source === 'size_variant' || source === 'base' ? { layersSource: source } : {}),
          ...(typeof usingBase === 'boolean' ? { usingBaseLayers: usingBase } : {}),
          ...(textValue(record.message).trim() ? { message: textValue(record.message) } : {})
        } satisfies FontLayoutSizeOptionStatus;
      }).filter((item) => item.sizeOptionId);
    },
    syncSizeOptions: async (
      templateId: number,
      sizeTemplateId: number,
      items: FontLayoutSizeOptionsSyncItem[]
    ): Promise<FontLayoutSizeOptionsSyncResult> => {
      const response = unwrapApiData(await apiRequest<unknown>({
        method: 'POST',
        url: `/font-layout-templates/${templateId}/sync-size-options`,
        data: {
          size_template_id: sizeTemplateId,
          items: items.map((item) => ({
            size_option_id: item.sizeOptionId,
            layers: fontLayoutLayerPayload(item.layers)
          }))
        }
      }));
      const record = recordValue(response);
      const justSynced = record.just_synced_size_option_ids ?? record.justSyncedSizeOptionIds;
      const missing = record.missing_size_option_ids ?? record.missingSizeOptionIds;
      const syncedCount = Number(record.synced_count ?? record.syncedCount);
      return {
        ...(Number.isFinite(syncedCount) ? { syncedCount } : {}),
        justSyncedSizeOptionIds: Array.isArray(justSynced) ? justSynced.map(textValue).filter(Boolean) : [],
        missingSizeOptionIds: Array.isArray(missing) ? missing.map(textValue).filter(Boolean) : [],
        ...(textValue(record.message).trim() ? { message: textValue(record.message) } : {})
      };
    }
  },
  fontLayoutTemplates: {
    list: async (filters: { shopId?: number; sizeTemplateId?: number; limit?: number; offset?: number } = {}): Promise<FontLayoutTemplate[]> => (
      normalizeFontLayoutTemplateList(await apiRequest<unknown>({
        method: 'GET',
        url: '/font-templates',
        params: {
          limit: filters.limit ?? 500,
          offset: filters.offset ?? 0,
          shop_id: filters.shopId,
          size_template_id: filters.sizeTemplateId
        }
      }))
    ),
    get: async (templateId: number, sizeOption?: string): Promise<FontLayoutTemplate> => (
      toFontLayoutTemplate(await apiRequest<unknown>({
        method: 'GET',
        url: `/font-templates/${templateId}`,
        params: sizeOption ? { size_option: sizeOption } : undefined
      }))
    ),
    create: async (payload: { shopId: number; sizeTemplateId: number; name: string; description?: string; safeDistance?: number; elements: Record<string, unknown>[]; options?: Record<string, unknown> }): Promise<FontLayoutTemplate> => (
      toFontLayoutTemplate(await apiRequest<unknown>({
        method: 'POST',
        url: '/font-templates',
        data: {
          shop_id: payload.shopId,
          size_template_id: payload.sizeTemplateId,
          name: payload.name,
          description: payload.description ?? '',
          elements: payload.elements,
          options: {
            ...(payload.options ?? {}),
            safe_distance: payload.safeDistance ?? 0
          }
        }
      }))
    ),
    update: async (templateId: number, payload: { shopId?: number; sizeTemplateId?: number; name?: string; description?: string; safeDistance?: number; elements?: Record<string, unknown>[]; options?: Record<string, unknown> }, sizeOption?: string): Promise<FontLayoutTemplate> => (
      toFontLayoutTemplate(await apiRequest<unknown>({
        method: 'PUT',
        url: `/font-templates/${templateId}`,
        params: sizeOption ? { size_option: sizeOption } : undefined,
        data: {
          ...(payload.shopId !== undefined ? { shop_id: payload.shopId } : {}),
          ...(payload.sizeTemplateId !== undefined ? { size_template_id: payload.sizeTemplateId } : {}),
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.elements !== undefined ? { elements: payload.elements } : {}),
          ...(payload.options !== undefined ? { options: {
            ...payload.options,
            ...(payload.safeDistance !== undefined ? { safe_distance: payload.safeDistance } : {})
          } } : payload.safeDistance !== undefined ? { options: { safe_distance: payload.safeDistance } } : {})
        }
      }))
    ),
    syncSizeOptions: async (
      templateId: number,
      payload: { sizeOption: string; elements: Record<string, unknown>[]; canvas?: { width: number; height: number } }
    ): Promise<FontLayoutSyncResult> => {
      const response = unwrapApiData(await apiRequest<unknown>({
        method: 'POST',
        url: `/font-templates/${templateId}/sync-size-options`,
        data: {
          size_option: payload.sizeOption,
          ...(payload.canvas ? { canvas: payload.canvas } : {}),
          elements: payload.elements
        }
      }));
      const record = recordValue(response);
      const canvas = recordValue(record.canvas);
      const canvasWidth = numberValue(canvas.width);
      const canvasHeight = numberValue(canvas.height);
      const canvasDpi = numberValue(canvas.dpi);
      const syncedSizeOptionIdsValue = record.synced_size_option_ids ?? record.syncedSizeOptionIds;
      return {
        id: numberValue(record.id ?? templateId),
        ...(numberValue(record.size_template_id) > 0 ? { sizeTemplateId: numberValue(record.size_template_id) } : {}),
        sizeOption: textValue(record.size_option ?? payload.sizeOption),
        ...(canvasWidth > 0 && canvasHeight > 0
          ? { canvas: { width: canvasWidth, height: canvasHeight, ...(canvasDpi > 0 ? { dpi: canvasDpi } : {}) } }
          : {}),
        elements: Array.isArray(record.elements)
          ? record.elements.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          : [],
        syncedSizeOptionIds: Array.isArray(syncedSizeOptionIdsValue)
          ? syncedSizeOptionIdsValue.map(textValue).filter(Boolean)
          : []
      };
    },
    delete: async (templateId: number): Promise<void> => {
      await apiRequest<unknown>({ method: 'DELETE', url: `/font-templates/${templateId}` });
    }
  },
  templateImports: {
    analyze: async (file: File, options: Record<string, unknown> = {}): Promise<TemplateImportAnalyzeResult> => {
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('options_json', JSON.stringify(options));
      return templateImportResult(await apiRequest<unknown>({
        method: 'POST',
        url: '/template-imports/analyze',
        data: formData,
        timeout: 120_000
      }));
    },
    finalize: async (
      template: TemplateImportDraft,
      sizeTemplateId?: number,
      strictFonts = true
    ): Promise<TemplateImportFinalizeResult> => unwrapApiData(await apiRequest<unknown>({
      method: 'POST',
      url: '/template-imports/finalize',
      timeout: 120_000,
      data: {
        template_json: template,
        strict_fonts: strictFonts,
        size_template_id: sizeTemplateId
      }
    })) as TemplateImportFinalizeResult
  },
  fonts: {
    listPage: async ({
      limit = 25,
      offset = 0,
      search,
    }: { limit?: number; offset?: number; search?: string } = {}) => normalizeFontListPage(await apiRequest<unknown>({
      method: 'GET',
      url: '/fonts',
      params: {
        limit,
        offset,
        ...(search?.trim() ? { search: search.trim() } : {}),
      }
    })),
    list: async ({
      limit = 100,
      offset = 0,
      search,
    }: { limit?: number; offset?: number; search?: string } = {}): Promise<FontLibraryItem[]> => normalizeFontList(await apiRequest<unknown>({
      method: 'GET',
      url: '/fonts',
      params: {
        limit,
        offset,
        ...(search?.trim() ? { search: search.trim() } : {}),
      }
    })),
    upload: async (payload: FontUploadPayload): Promise<FontLibraryItem> => {
      const formData = new FormData();
      formData.append('file', payload.file, payload.file.name);
      if (payload.fontName?.trim()) formData.append('font_name', payload.fontName.trim());
      if (payload.fontFamily?.trim()) formData.append('font_family', payload.fontFamily.trim());
      if (payload.enabled !== undefined) formData.append('enabled', String(payload.enabled));
      return normalizeFontList(await apiRequest<unknown>({ method: 'POST', url: '/fonts/upload', data: formData, timeout: 120_000 }))[0];
    },
    update: async (fontId: number, payload: FontUpdatePayload): Promise<FontLibraryItem> => normalizeFontList(await apiRequest<unknown>({
      method: 'PATCH',
      url: `/fonts/${fontId}`,
      data: {
        ...(payload.fontName !== undefined ? { font_name: payload.fontName } : {}),
        ...(payload.fontFamily !== undefined ? { font_family: payload.fontFamily } : {}),
        ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {})
      }
    }))[0]
  },
  textGenerationRules: {
    listPage: listTextGenerationRules,
    list: listTextGenerationRules,
    get: async (ruleId: number): Promise<TextGenerationRule> => toTextGenerationRule(await apiRequest<unknown>({
      method: 'GET',
      url: `/text-generation-rules/${encodeURIComponent(ruleId)}`
    })),
    create: async (payload: TextGenerationRulePayload): Promise<TextGenerationRule> => toTextGenerationRule(await apiRequest<unknown>({
      method: 'POST',
      url: '/text-generation-rules',
      data: textGenerationRulePayload(payload)
    })),
    update: async (ruleId: number, payload: TextGenerationRulePayload): Promise<TextGenerationRule> => toTextGenerationRule(await apiRequest<unknown>({
      method: 'PATCH',
      url: `/text-generation-rules/${encodeURIComponent(ruleId)}`,
      data: textGenerationRulePayload(payload)
    }))
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
