export type OrderItem = {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  customInfo: string;
  quantity: number;
  raw: Record<string, string>;
};

export type Order = {
  id: string;
  orderNo: string;
  customerName: string;
  status: string;
  sourceUpdatedAt?: string;
  raw: Record<string, string>;
  items: OrderItem[];
};

export type TemplateRule = {
  id: string;
  sku: string;
  productType: string;
  baseTemplateId: string;
  priority: number;
  enabled: boolean;
};

export type TemplateBinding = {
  objectId: string;
  source: 'order' | 'orderItem' | 'asset' | 'manual';
  field: string;
  fallback?: string;
};

export type AlbumTemplatePage = {
  id: string;
  name: string;
  width: number;
  height: number;
  dpi: number;
  fabricJson: unknown;
  bindings: TemplateBinding[];
};

export type AlbumTemplateDocument = {
  schemaVersion: '1.0';
  id: string;
  name: string;
  source: {
    kind: 'manual' | 'generated' | 'imported' | 'saved-as';
    orderId?: string;
    importFormat?: 'svg' | 'jpg' | 'pdf' | 'psd' | 'eps' | 'acp';
  };
  pages: AlbumTemplatePage[];
  createdAt: string;
  updatedAt: string;
};

export type TemplateSummary = {
  id: string;
  name: string;
  sourceKind: AlbumTemplateDocument['source']['kind'];
  sourceOrderId?: string;
  version: number;
  updatedAt: string;
};

export type ExportFormat = 'cdr' | 'psd' | 'eps' | 'svg' | 'jpg' | 'pdf';

export type ExportHistoryEntry = {
  id: string;
  templateId: string;
  orderId?: string;
  format: ExportFormat;
  targetPath: string;
  status: 'created' | 'failed';
  message?: string;
  createdAt: string;
};

export type LocalUserProfile = {
  id: string;
  displayName: string;
  email: string;
  role: 'admin' | 'designer' | 'operator';
  updatedAt: string;
};
