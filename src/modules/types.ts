import type {
  AlbumTemplateDocument,
  ExportHistoryEntry,
  LocalUserProfile,
  Order,
  TemplateSummary
} from '@shared/domain';

export type ModuleId = 'orders' | 'shops' | 'editor' | 'templates' | 'exports' | 'account';

export type ModulePageProps = {
  setStatus(message: string): void;
};

export type EditorPageProps = ModulePageProps & {
  orders: Order[];
  selectedOrderId: string;
  selectedOrder?: Order;
  currentDocument?: AlbumTemplateDocument;
  setCurrentDocument(document: AlbumTemplateDocument | undefined): void;
  setSelectedOrderId(orderId: string): void;
};

export type TemplatePageProps = ModulePageProps & {
  templates: TemplateSummary[];
  openTemplate(templateId: string): Promise<void>;
};

export type ExportsPageProps = {
  exports: ExportHistoryEntry[];
};

export type AccountPageProps = ModulePageProps & {
  account?: LocalUserProfile;
  setAccount(account: LocalUserProfile): void;
};

export type OrdersPageProps = {
  orders: Order[];
  selectedOrderId: string;
  loading: boolean;
  loadError: string;
  reloadOrders(): Promise<void>;
  setSelectedOrderId(orderId: string): void;
  openOrderInEditor(order: Order): void;
};
