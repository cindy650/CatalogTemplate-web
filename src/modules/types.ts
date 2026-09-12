import type {
  ExportHistoryEntry,
  LocalUserProfile,
  Order,
  OrderListFilters,
  OrderStatusDefinition,
  ProductCategory,
  Shop,
  CatalogSizeTemplate,
  SizeTemplate,
  TemplateSummary
} from '@shared/domain';
import type { TemplateLibraryShopSelection } from './moduleRegistry';

export type ModuleId = 'orders' | 'shops' | 'inner-pages' | 'size-templates' | 'template-library' | 'text-generation-rules' | 'font-layouts' | 'fonts' | 'editor' | 'image-map-test' | 'ui-prototype' | 'exports' | 'account';

export type ModulePageProps = {
  setStatus(message: string): void;
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
  orderTotal: number;
  orderLimit: number;
  orderPage: number;
  orderStatuses: OrderStatusDefinition[];
  shops: Shop[];
  filters: OrderListFilters;
  selectedOrderId: string;
  loading: boolean;
  loadError: string;
  reloadOrders(filters?: OrderListFilters): Promise<void>;
  setSelectedOrderId(orderId: string): void;
  openOrderInEditor(order: Order): void;
};

export type ShopsPageProps = {
  shops: Shop[];
  loading: boolean;
  loadError: string;
  reloadShops(): Promise<void>;
  openShopOrders(shop: Shop, status?: number): void;
  openShopSizeTemplates(shop: Shop): void;
};

export type SizeTemplatesPageProps = {
  shops: Shop[];
  selectedShopId?: number;
  selectedProductId?: number;
  initialTemplateId?: number;
  embedded?: boolean;
  onEditorExit?(): void;
  onTemplatesChange?(templates: SizeTemplate[]): void;
};

export type TemplateLibraryPageProps = {
  products: ProductCategory[];
  shops: Shop[];
  selectedProductId?: number;
  selectedShopId: TemplateLibraryShopSelection;
  onOpenTemplate(template: CatalogSizeTemplate): void;
  onCreateProduct(): void;
  onEditProduct(product: ProductCategory): void;
  onDeleteProduct(product: ProductCategory): void;
  onEditorModeChange?(editing: boolean): void;
};

export type InnerPagesPageProps = {
  shops: Shop[];
  products: ProductCategory[];
  selectedShopId?: number;
  selectedProductId?: number;
  onEditorModeChange?(editing: boolean): void;
};
