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
  status: number;
  statusText: string;
  statusButtonText: string;
  createdAt?: string;
  shopId?: number;
  productId?: number;
  sizeTemplateId?: string;
  matchedTemplate: Record<string, unknown>;
  resolvedLayers: Record<string, unknown>;
  sourceUpdatedAt?: string;
  fieldLabels: Record<string, string>;
  productInformation: Record<string, string>;
  productInformationLabels: Record<string, string>;
  raw: Record<string, string>;
  items: OrderItem[];
};

export type OrderListFilters = {
  orderNumber?: string;
  shop?: string;
  status?: number;
  limit?: number;
  pages?: number;
};

export type OrderListResult = {
  items: Order[];
  total: number;
  limit: number;
  pages: number;
  totalPages: number;
};

export type OrderStatusDefinition = {
  status: number;
  statusText: string;
  statusButtonText: string;
};

export type Shop = {
  id: number;
  shop: string;
  shopName: string;
  wecomRobotWebhookUrl?: string;
  products: string[];
  productCount: number;
  orderCount: number;
  newOrderCount: number;
  confirmationCount: number;
  pendingProductionCount: number;
  inProductionCount: number;
  pendingShipmentCount: number;
  completedOrderCount: number;
  sizeTemplateCount: number;
  fontTemplateCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ShopPayload = {
  shop: string;
  shopName: string;
  wecomRobotWebhookUrl?: string;
  products: string[];
};

export type ProductShop = {
  id: number;
  shop: string;
  shopName: string;
};

export type ProductCommonSpecValue = {
  id: string;
  label: string;
  unit: SizeTemplateUnit;
  pageCount: number;
  pageCountOptions: number[];
  sideWidth: number;
  sideHeight: number;
  bleed: number;
  spineWidthMode: 'fixed' | 'by_page_count';
  spineWidth: number;
  minSpineWidth: number;
  maxSpineWidth: number;
  spineBleed: number;
  paperThickness: number;
};

export type SpineWidthFormula = {
  unit: SizeTemplateUnit;
  pageCountCoefficient: number;
  pageCountThickness: number;
  baseWidth: number;
  additionalWidth: number;
  spineBleed: number;
};

export type ProductCategory = {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
  productNames: string[];
  specifications: string[];
  specificationField: string;
  commonSpecValues: ProductCommonSpecValue[];
  spineWidthFormula?: SpineWidthFormula;
  backCoverSafeDistance: SafeDistance;
  coverSafeDistance: SafeDistance;
  spineSafeDistance: SafeDistance;
  shopIds: number[];
  shops: ProductShop[];
  sizeTemplateIds: number[];
};

export type ProductCategoryPayload = {
  name: string;
  description?: string;
  productNames: string[];
  specifications: string[];
  specificationField: string;
  commonSpecValues?: ProductCommonSpecValue[];
  spineWidthFormula?: SpineWidthFormula;
  backCoverSafeDistance: SafeDistance;
  coverSafeDistance: SafeDistance;
  spineSafeDistance: SafeDistance;
  shopIds: number[];
  enabled?: boolean;
};

export type SizeTemplateUnit = 'mm' | 'cm' | 'in';

export type SizeTemplateUnitValues = {
  single_side_width: number;
  single_side_height: number;
  bleed: number;
  spine_width: number;
  spine_bleed: number;
};

export type SizeTemplateFormSizeData = SizeTemplateUnitValues & {
  page_count: number;
  page_count_arr: number[];
  spine_width_mode: 'fixed' | 'by_page_count';
  spine_width_formula?: Record<string, unknown>;
};

export type SizeTemplateFormOption = {
  id?: string;
  value: string;
  label: string;
  disabled: boolean;
  page_count: number;
  spine_width_mode: 'fixed' | 'by_page_count';
  size_unit?: SizeTemplateUnit;
  in?: SizeTemplateUnitValues | null;
  mm?: SizeTemplateUnitValues | null;
  cm?: SizeTemplateUnitValues | null;
};

export type SizeTemplateFormData = SizeTemplateFormSizeData & {
  size_option: string | null;
  size_unit: SizeTemplateUnit;
  size_unit_options: SizeTemplateUnit[];
  size_options: SizeTemplateFormOption[];
  status: string;
};

export type FontLayoutTemplate = {
  id: number;
  shopId: number;
  sizeTemplateId?: number;
  safeDistance: number;
  name: string;
  description: string;
  fontId?: number;
  fontName: string;
  createdAt: string;
  updatedAt: string;
  sizeOption?: string;
  canvas?: { width: number; height: number; dpi?: number };
  syncedSizeOptionIds?: string[];
  /** Detail responses expose whether the requested size already has a generated layout. */
  isSynced?: boolean;
  syncRequired?: boolean;
  /** Full template payload is returned by the detail endpoint; list responses may omit it. */
  elements?: Record<string, unknown>[];
  options?: Record<string, unknown>;
};

export type FontLayoutSyncResult = {
  id: number;
  sizeTemplateId?: number;
  sizeOption: string;
  /** Optional compatibility response; synchronization no longer depends on browser canvas dimensions. */
  canvas?: { width: number; height: number; dpi?: number };
  elements: Record<string, unknown>[];
  syncedSizeOptionIds: string[];
};

export type SizeTemplate = {
  id: number;
  shopId: number;
  shop: string;
  shopName: string;
  name: string;
  product: string;
  products: string[];
  sizeForm: SizeTemplateFormData;
  fontLayoutTemplates: FontLayoutTemplate[];
  fontLayoutTemplateIds: number[];
  unit: SizeTemplateUnit;
  singleWidth: number;
  singleHeight: number;
  spineWidth: number;
  bleed: number;
  spineBleed: number;
  pages: number;
  enabled: boolean;
  notes: string;
  layoutTemplate?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SizeTemplateOptionPayload = {
  id: string;
  label: string;
  size_unit: SizeTemplateUnit;
  single_side_width: number;
  single_side_height: number;
  bleed: number;
  spine_width: number;
  spine_bleed: number;
  spine_width_mode: 'fixed' | 'by_page_count';
  select?: boolean;
};

export type SizeTemplatePayload = {
  shopId: number;
  name: string;
  products: string[];
  unit: SizeTemplateUnit;
  sizeOption?: string | null;
  pageCount: number;
  pageCountArr: number[];
  sizeOptions: SizeTemplateOptionPayload[];
};

export type CatalogSizeOptionFields = {
  size_unit: SizeTemplateUnit;
  single_side_width: number;
  single_side_height: number;
  bleed: number;
  spine_width: number;
  spine_bleed: number;
  unit_values?: {
    single_side_width: Record<SizeTemplateUnit, number>;
    single_side_height: Record<SizeTemplateUnit, number>;
    bleed: Record<SizeTemplateUnit, number>;
    spine_width: Record<SizeTemplateUnit, number>;
    spine_bleed: Record<SizeTemplateUnit, number>;
  };
};

export type CatalogSizeOption = {
  id: string;
  label: string;
  fields: CatalogSizeOptionFields;
  layers?: FontLayoutLayerData;
};

export type InnerPageSizeOption = {
  id: string;
  label: string;
  sizeUnit: SizeTemplateUnit;
  layers: FontLayoutLayerData;
};

export type InnerPageSizeOptionUpdatePayload = Partial<Pick<InnerPageSizeOption, 'label' | 'sizeUnit' | 'layers'>>;

export type InnerPageTemplate = {
  id: number;
  shopId: number;
  productId: number;
  name: string;
  description: string;
  previewImagePath: string;
  sizeOptions: InnerPageSizeOption[];
  createdAt: string;
  updatedAt: string;
};

export type InnerPageTemplatePayload = {
  shopId?: number;
  productId: number;
  name?: string;
  description?: string;
  previewImagePath?: string;
  sizeOptions?: InnerPageSizeOption[];
};

export type SafeDistance = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type FontLayoutCanvas = {
  width: number;
  height: number;
  dpi?: number;
};

export type MountedSizeLayout = {
  sizeOptionId: string;
  layers: Record<string, unknown>[];
  canvas: FontLayoutCanvas;
};

export type MountedFontLayout = {
  id: string;
  fontLayoutTemplateId: number;
  name: string;
  previewImage: string;
  sizeLayouts: MountedSizeLayout[];
};

export type CatalogSizeTemplate = {
  id: number;
  productId?: number;
  selectedFontLayoutId?: number;
  productCategoryName?: string;
  shopId: number;
  shop?: string;
  shopName: string;
  name: string;
  previewImage: string;
  applicableProducts: string[];
  backgroundColor: string;
  minSpineWidth: number;
  maxSpineWidth: number;
  paperThicknessMm: number;
  spineWidthBasis: 0 | 1;
  backCoverSafeDistance: SafeDistance;
  coverSafeDistance: SafeDistance;
  spineSafeDistance: SafeDistance;
  selectedSizeOptionId: string;
  displayUnit: SizeTemplateUnit;
  pageCount: number;
  pageCountOptions: number[];
  sizeOptions: CatalogSizeOption[];
  sizeTemplateInfo: Record<string, unknown>[];
  fontLayouts: MountedFontLayout[];
  createdAt: string;
  updatedAt: string;
};

export type CatalogSizeTemplatePayload = {
  shopId: number;
  productId?: number;
  name: string;
  previewImage: string;
  applicableProducts: string[];
  backgroundColor: string;
  minSpineWidth: number;
  maxSpineWidth: number;
  paperThicknessMm: number;
  spineWidthBasis: 0 | 1;
  backCoverSafeDistance: SafeDistance;
  coverSafeDistance: SafeDistance;
  spineSafeDistance: SafeDistance;
  selectedSizeOptionId: string | null;
  displayUnit: SizeTemplateUnit;
  pageCount: number;
  pageCountOptions: number[];
  sizeOptions: CatalogSizeOption[];
  sizeTemplateInfo: Record<string, unknown>[];
  fontLayouts: MountedFontLayout[];
};

export type FontLayoutLibraryTemplate = {
  id: number;
  shopId: number;
  productId?: number;
  productCategoryName?: string;
  name: string;
  sortKey: string;
  previewImage: string;
  layers: FontLayoutLayerData;
  isCurrentSizeTemplateLayout?: boolean;
  layersSource?: 'size_template_option' | 'size_variant' | 'base';
  usingBaseLayers?: boolean;
  message?: string;
  createdAt: string;
  updatedAt: string;
};

export type FontLayoutLayerData = {
  objects: Record<string, unknown>[];
  animations: Record<string, unknown>[];
  styles: Record<string, unknown>[];
  dataSources: Record<string, unknown>[];
};

export type FontLayoutLibraryPayload = {
  shopId: number;
  productId?: number;
  name: string;
  sortKey: string;
  layers: FontLayoutLayerData;
};

export type FontLayoutSizeOptionStatus = {
  sizeOptionId: string;
  label?: string;
  hasSizeVariant?: boolean;
  layersSource?: 'size_template_option' | 'size_variant' | 'base';
  usingBaseLayers?: boolean;
  message?: string;
};

export type FontLayoutSizeOptionsSyncItem = {
  sizeOptionId: string;
  layers: FontLayoutLayerData;
};

export type FontLayoutSizeOptionsSyncResult = {
  syncedCount?: number;
  justSyncedSizeOptionIds: string[];
  missingSizeOptionIds: string[];
  message?: string;
};

export type AddMountedFontLayoutPayload = {
  fontLayoutTemplateId: number;
  sourceSizeOptionId: string;
  name: string;
};

export type SaveMountedSizeLayoutPayload = {
  layers: Record<string, unknown>[];
  canvas: FontLayoutCanvas;
};

export type SyncMountedFontLayoutPayload = {
  sourceSizeOptionId: string;
  targetSizeOptionIds: string[];
  mode: 'scale' | 'copy';
};

export type TemplateImportDraft = Record<string, unknown>;

export type TemplateImportAnalyzeResult = {
  template: TemplateImportDraft;
  warnings?: string[];
  [key: string]: unknown;
};

export type TemplateImportFinalizeResult = {
  template: TemplateImportDraft;
  savedSizeTemplate?: Record<string, unknown>;
  [key: string]: unknown;
};

export type FontLibraryItem = {
  id: number;
  shopId?: number;
  name: string;
  family: string;
  preferredName: string;
  englishName: string;
  allName: string;
  postscriptName: string;
  filePath: string;
  enabled: boolean;
};

export type FontUploadPayload = {
  file: File;
  fontName?: string;
  fontFamily?: string;
  enabled?: boolean;
};

export type FontUpdatePayload = {
  fontName?: string;
  fontFamily?: string;
  enabled?: boolean;
};

export type TemplateRule = {
  id: string;
  sku: string;
  productType: string;
  baseTemplateId: string;
  priority: number;
  enabled: boolean;
};

export type TextGenerationRule = {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type TemplateRuleDescription = TextGenerationRule;

export type TextGenerationRulePayload = {
  name: string;
  description: string;
};

export type TextGenerationRuleListResult = {
  items: TextGenerationRule[];
  total: number;
  limit: number;
  offset: number;
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

export type OrderTemplateExportFormat = 'eps' | 'svg' | 'jpg' | 'png';

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
