import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { App, Avatar, Badge, Breadcrumb, Button, Dropdown, Form, Input, InputNumber, Layout, Menu, Modal, Segmented, Select, Spin, Switch, Tag, Tooltip, Typography } from 'antd';
import { BellOutlined, DeleteOutlined, DownOutlined, LeftOutlined, MinusOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import type { LocalUserProfile, ProductBleed, ProductCategory, ProductCategoryPayload, ProductCommonSpecValue, ProductSpineWidthMode, SafeDistance, Shop, SpineWidthFormula, SpineWidthPageRules } from '@shared/domain';
import type { ModuleId } from '../modules/types';
import { resolveImageMapSpineWidth } from '../image-map-editor/editors/imagemap/ImageMapSizeScheme';
import {
  getModuleDefinition,
  getModuleMenuItems,
  getInnerPagesMenuSelection,
  getInnerPagesProductMenuKey,
  getInnerPagesShopMenuKey,
  getFontLayoutsMenuSelection,
  getFontLayoutsProductMenuKey,
  getFontLayoutsShopMenuKey,
  getSizeTemplateShopIdFromMenuKey,
  getSizeTemplateShopMenuKey,
  getProductMenuSelection,
  getProductMenuKey,
  getProductAllMenuKey,
  getProductShopMenuKey,
  isProductAddMenuKey
} from '../modules/moduleRegistry';
import type { ProductMenuActions } from '../modules/moduleRegistry';
import type { TemplateLibraryShopSelection } from '../modules/moduleRegistry';
import WeatherBreadcrumb, { type WeatherTone } from './WeatherBreadcrumb';

const { Header, Sider, Content } = Layout;

const emptySafeDistance = (): SafeDistance => ({ top: 0, right: 0, bottom: 0, left: 0 });

function normalizedSafeDistance(value?: Partial<SafeDistance>): SafeDistance {
  return {
    top: Number(value?.top) || 0,
    right: Number(value?.right) || 0,
    bottom: Number(value?.bottom) || 0,
    left: Number(value?.left) || 0
  };
}

function SafeDistanceFormFields({
  label,
  name
}: {
  label: string;
  name: 'backCoverSafeDistance' | 'coverSafeDistance' | 'spineSafeDistance';
}) {
  return (
    <div className="product-safe-distance-group">
      <Typography.Text strong>{label}</Typography.Text>
      <div className="product-safe-distance-grid">
        {([['top', '上'], ['right', '右'], ['bottom', '下'], ['left', '左']] as const).map(([side, sideLabel]) => (
          <Form.Item key={side} name={[name, side]} label={sideLabel}>
            <InputNumber min={0} />
          </Form.Item>
        ))}
      </div>
    </div>
  );
}

const defaultCommonSpecValue: ProductCommonSpecValue = {
  id: '',
  label: '',
  unit: 'in',
  pageCount: 50,
  pageCountOptions: [50],
  sideWidth: 9,
  sideHeight: 6,
  bleed: 0.79,
  spineWidthMode: 'fixed',
  spineWidth: 0.55,
  minSpineWidth: 0.55,
  maxSpineWidth: 0.7,
  spineBleed: 0.55,
  paperThickness: 0
};

const emptyDoubleBleed = (value = 0): ProductBleed => ({ top: value, right: value, bottom: value, left: value });

function normalizeProductBleed(value: unknown, mode: 'single' | 'double'): number | ProductBleed {
  if (mode === 'single') {
    if (typeof value === 'object' && value !== null) return Number((value as Partial<ProductBleed>).left) || 0;
    return Number(value) || 0;
  }
  if (typeof value === 'object' && value !== null) {
    const current = value as Partial<ProductBleed>;
    return {
      top: Number(current.top) || 0,
      right: Number(current.right) || 0,
      bottom: Number(current.bottom) || 0,
      left: Number(current.left) || 0
    };
  }
  return emptyDoubleBleed(Number(value) || 0);
}

const defaultSpineWidthFormula: SpineWidthFormula = {
  unit: 'cm',
  pageCountCoefficient: 0.2,
  pageCountThickness: 0.3,
  baseWidth: 1,
  additionalWidth: 0.9,
  spineBleed: 0
};

const defaultSpineWidthPageRules: SpineWidthPageRules = {
  unit: 'cm',
  matchStrategy: 'exact',
  items: [
    { pageCount: 10, spineWidth: 1.5, spineBleed: 0 },
    { pageCount: 20, spineWidth: 1.8, spineBleed: 0 }
  ]
};

function normalizedSpineWidthFormula(value?: Partial<SpineWidthFormula>): SpineWidthFormula | undefined {
  if (!value) return undefined;
  return {
    unit: value.unit === 'in' || value.unit === 'mm' ? value.unit : 'cm',
    pageCountCoefficient: Number(value.pageCountCoefficient) || 0,
    pageCountThickness: Number(value.pageCountThickness) || 0,
    baseWidth: Number(value.baseWidth) || 0,
    additionalWidth: Number(value.additionalWidth) || 0,
    spineBleed: 0
  };
}

function normalizedSpineWidthPageRules(value?: Partial<SpineWidthPageRules>): SpineWidthPageRules | undefined {
  if (!value) return undefined;
  const items = Array.isArray(value.items) ? value.items.map(item => ({
    pageCount: Math.max(1, Math.round(Number(item.pageCount) || 0)),
    spineWidth: Math.max(0, Number(item.spineWidth) || 0),
    spineBleed: Math.max(0, Number(item.spineBleed) || 0)
  })).filter(item => item.pageCount > 0) : [];
  return {
    unit: value.unit === 'in' || value.unit === 'mm' ? value.unit : 'cm',
    matchStrategy: 'exact',
    items: items.sort((left, right) => left.pageCount - right.pageCount)
  };
}

function normalizedCommonSpecValue(
  value: Partial<ProductCommonSpecValue>,
  formula?: SpineWidthFormula,
  bleedMode: 'single' | 'double' = 'single',
  productSpineWidthMode: ProductSpineWidthMode = 'range',
  pageRules?: SpineWidthPageRules
): ProductCommonSpecValue {
  const pageCountOptions = Array.isArray(value.pageCountOptions)
    ? value.pageCountOptions.map(Number).filter((count) => Number.isFinite(count) && count > 0)
    : [];
  const pageCount = Number(value.pageCount) > 0
    ? Number(value.pageCount)
    : pageCountOptions[0] ?? 50;
  const spineWidthMode = productSpineWidthMode === 'range' ? 'fixed' : 'by_page_count';
  const usesFormula = Boolean(formula) && productSpineWidthMode === 'formula';
  const unit = value.unit === 'mm' || value.unit === 'cm' ? value.unit : 'in';
  const tableRule = productSpineWidthMode === 'page_count_table' ? matchedSpineWidthPageRule(pageRules, pageCount) : undefined;
  const spineWidth = usesFormula
    ? resolveImageMapSpineWidth({
      ...value,
      bleed: typeof value.bleed === 'number' ? value.bleed : Number(value.bleed?.left ?? value.bleed?.right ?? 0),
      pageCount,
      pageCountOptions,
      spineWidthMode,
      spineWidthFormula: formula
    })
    : tableRule
      ? convertSpineRuleValue(tableRule.spineWidth, pageRules?.unit ?? unit, unit)
      : Number(value.spineWidth) || 0;
  return {
    label: String(value.label ?? '').trim(),
    id: String(value.label ?? '').trim(),
    unit,
    pageCount,
    pageCountOptions: pageCountOptions.length ? pageCountOptions : [pageCount],
    sideWidth: Number(value.sideWidth) || 0,
    sideHeight: Number(value.sideHeight) || 0,
    bleed: normalizeProductBleed(value.bleed, bleedMode),
    spineWidthMode,
    spineWidth,
    minSpineWidth: usesFormula ? 0 : Number(value.minSpineWidth) || 0,
    maxSpineWidth: usesFormula ? 0 : Number(value.maxSpineWidth) || 0,
    spineBleed: tableRule
      ? convertSpineRuleValue(tableRule.spineBleed, pageRules?.unit ?? unit, unit)
      : Number(value.spineBleed) || 0,
    paperThickness: usesFormula ? 0 : Number(value.paperThickness) || 0
  };
}

const unitToInches: Record<ProductCommonSpecValue['unit'], number> = {
  in: 1,
  cm: 1 / 2.54,
  mm: 1 / 25.4
};

function matchedSpineWidthPageRule(rules: SpineWidthPageRules | undefined, pageCount: number) {
  if (!Array.isArray(rules?.items) || rules.items.length === 0) return undefined;
  const ordered = rules.items.slice().sort((left, right) => left.pageCount - right.pageCount);
  if (rules.matchStrategy === 'floor') return ordered.slice().reverse().find(item => item.pageCount <= pageCount);
  if (rules.matchStrategy === 'ceil') return ordered.find(item => item.pageCount >= pageCount);
  return ordered.find(item => item.pageCount === pageCount);
}

function convertSpineRuleValue(value: number, from: ProductCommonSpecValue['unit'], to: ProductCommonSpecValue['unit']) {
  if (from === to) return value;
  return value * unitToInches[from] / unitToInches[to];
}

const commonSpecDimensionFields = [
  'sideWidth',
  'sideHeight',
  'bleed',
  'spineWidth',
  'minSpineWidth',
  'maxSpineWidth',
  'spineBleed'
] as const;

function convertCommonSpecUnit(
  values: Partial<ProductCommonSpecValue>,
  from: ProductCommonSpecValue['unit'],
  to: ProductCommonSpecValue['unit']
): Partial<ProductCommonSpecValue> {
  if (from === to) return { ...values, unit: to };
  const factor = unitToInches[from] / unitToInches[to];
  const converted = { ...values, unit: to };
  commonSpecDimensionFields.forEach((field) => {
    const value = values[field];
    if (value === undefined || value === null) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    converted[field] = Number((numeric * factor).toFixed(4));
  });
  if (typeof values.bleed === 'object' && values.bleed !== null) {
    converted.bleed = Object.fromEntries(
      Object.entries(values.bleed).map(([side, sideValue]) => [side, Number((Number(sideValue) * factor).toFixed(4))])
    ) as ProductBleed;
  }
  return converted;
}

function convertSpineWidthPageRulesUnit(value: SpineWidthPageRules, to: SpineWidthPageRules['unit']): SpineWidthPageRules {
  if (value.unit === to) return { ...value, unit: to };
  const factor = unitToInches[value.unit] / unitToInches[to];
  return {
    ...value,
    unit: to,
    items: value.items.map(item => ({
      ...item,
      spineWidth: Number((item.spineWidth * factor).toFixed(4)),
      spineBleed: Number((item.spineBleed * factor).toFixed(4))
    }))
  };
}

function hasCommonSpecValue(values: Partial<ProductCommonSpecValue> | undefined): boolean {
  if (!values) return false;
  return Object.entries(values).some(([field, value]) => {
    if (field === 'label' || field === 'id' || field === 'unit' || field === 'spineWidthMode') return false;
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== '';
  });
}

type AppLayoutProps = {
  activeModule: ModuleId;
  children: ReactNode;
  account?: LocalUserProfile;
  editorMode?: boolean;
  shops: Shop[];
  products: ProductCategory[];
  selectedSizeTemplatesShopId?: number;
  selectedTemplateLibraryProductId?: number;
  selectedTemplateLibraryShopId: TemplateLibraryShopSelection;
  selectedInnerPagesShopId?: number;
  selectedInnerPagesProductId?: number;
  selectedFontLayoutsShopId?: number;
  selectedFontLayoutsProductId?: number;
  status: string;
  onModuleChange(moduleId: ModuleId): void;
  onSizeTemplatesShopChange(shopId: number): void;
  onInnerPagesSelection(shopId: number, productId: number): void;
  onFontLayoutsSelection(shopId: number, productId: number): void;
  onTemplateLibrarySelection(productId: number, shopId: TemplateLibraryShopSelection): void;
  onClearTemplateLibraryContext(): void;
  onSaveProduct(productId: number | undefined, payload: ProductCategoryPayload): Promise<void>;
  onDeleteProduct(product: ProductCategory): Promise<void>;
  productEditor: ProductCategory | null | undefined;
  onOpenProductEditor(product: ProductCategory | null): void;
  onCloseProductEditor(): void;
};

export default function AppLayout({
  activeModule,
  children,
  account,
  editorMode = false,
  shops,
  products,
  selectedSizeTemplatesShopId,
  selectedTemplateLibraryProductId,
  selectedTemplateLibraryShopId,
  selectedInnerPagesShopId,
  selectedInnerPagesProductId,
  selectedFontLayoutsShopId,
  selectedFontLayoutsProductId,
  status,
  onModuleChange,
  onSizeTemplatesShopChange,
  onInnerPagesSelection,
  onFontLayoutsSelection,
  onTemplateLibrarySelection,
  onClearTemplateLibraryContext,
  onSaveProduct,
  onDeleteProduct,
  productEditor,
  onOpenProductEditor,
  onCloseProductEditor
}: AppLayoutProps) {
  const { message } = App.useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [weatherTone, setWeatherTone] = useState<WeatherTone>('neutral');
  const [openMenuKeys, setOpenMenuKeys] = useState<string[]>([]);
  const [productForm] = Form.useForm();
  const [productNames, setProductNames] = useState<string[]>([]);
  const [productDraft, setProductDraft] = useState('');
  const [productInputVisible, setProductInputVisible] = useState(false);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const productSubmittingRef = useRef(false);
  const commonSpecUnitsRef = useRef<Record<string, ProductCommonSpecValue['unit']>>({});
  const commonSpecValues = Form.useWatch('commonSpecValues', productForm) as Partial<ProductCommonSpecValue>[] | undefined;
  const productBleedMode = (Form.useWatch('bleedMode', productForm) === 'double' ? 'double' : 'single') as 'single' | 'double';
  const watchedDefaultPageCount = Form.useWatch('defaultPageCount', productForm);
  const defaultPageCount = Number(watchedDefaultPageCount) > 0
    ? Number(watchedDefaultPageCount)
    : 50;
  const watchedPageCountOptions = Form.useWatch('pageCountOptions', productForm);
  const parsedPageCountOptions = (Array.isArray(watchedPageCountOptions) ? watchedPageCountOptions : [])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  const commonPageCountOptions = parsedPageCountOptions.length ? parsedPageCountOptions : [50, 100];
  const spineWidthFormula = Form.useWatch('spineWidthFormula', {
    form: productForm,
    preserve: true
  }) as SpineWidthFormula | undefined;
  const spineWidthPageRules = Form.useWatch('spineWidthPageRules', {
    form: productForm,
    preserve: true
  }) as SpineWidthPageRules | undefined;
  const spineWidthMode = (Form.useWatch('spineWidthMode', productForm) as ProductSpineWidthMode | undefined) ?? 'range';
  const productUsesSpineWidthFormula = spineWidthMode === 'formula' && Boolean(spineWidthFormula);
  const showProductSpineWidthFormula = spineWidthMode === 'formula';
  const showProductSpineWidthPageRules = spineWidthMode === 'page_count_table';
  const activeModuleDefinition = getModuleDefinition(activeModule);
  const productActions: ProductMenuActions = useMemo(() => ({ onAdd: () => onOpenProductEditor(null), onEdit: onOpenProductEditor, onDelete: (product) => { void onDeleteProduct(product); } }), [onDeleteProduct, onOpenProductEditor]);
  const menuItems = useMemo(() => getModuleMenuItems(shops, products, productActions), [shops, products, productActions]);
  const selectedMenuKey = activeModule === 'template-library' && selectedTemplateLibraryProductId !== undefined
    ? (selectedTemplateLibraryShopId !== 'ALL' ? getProductShopMenuKey(selectedTemplateLibraryProductId, selectedTemplateLibraryShopId) : getProductAllMenuKey(selectedTemplateLibraryProductId))
    : activeModule === 'size-templates' && selectedSizeTemplatesShopId !== undefined
    ? getSizeTemplateShopMenuKey(selectedSizeTemplatesShopId)
    : activeModule === 'inner-pages' && selectedInnerPagesShopId !== undefined && selectedInnerPagesProductId !== undefined
      ? getInnerPagesProductMenuKey(selectedInnerPagesShopId, selectedInnerPagesProductId)
    : activeModule === 'font-layouts' && selectedFontLayoutsShopId !== undefined && selectedFontLayoutsProductId !== undefined
      ? getFontLayoutsProductMenuKey(selectedFontLayoutsShopId, selectedFontLayoutsProductId)
    : activeModule;
  const breadcrumbItems = useMemo(
    () => activeModuleDefinition.breadcrumb.map((title) => ({ title })),
    [activeModuleDefinition]
  );
  const accountName = account?.displayName?.trim() || '网页用户';
  const accountInitials = accountName.slice(0, 2).toUpperCase();
  const accountMenuItems = useMemo(() => [
    { key: 'account', label: '账号设置' }
  ], []);

  useEffect(() => {
    if (activeModule !== 'inner-pages' || collapsed) return;
    setOpenMenuKeys((current) => {
      const next = current.includes('inner-pages') ? current : [...current, 'inner-pages'];
      if (selectedInnerPagesShopId === undefined) return next;
      const shopKey = getInnerPagesShopMenuKey(selectedInnerPagesShopId);
      return next.includes(shopKey) ? next : [...next, shopKey];
    });
  }, [activeModule, collapsed, selectedInnerPagesShopId]);

  useEffect(() => {
    if (activeModule !== 'size-templates' || collapsed) return;
    setOpenMenuKeys((current) => current.includes('size-templates') ? current : [...current, 'size-templates']);
  }, [activeModule, collapsed]);

  useEffect(() => {
    if (activeModule !== 'font-layouts' || collapsed) return;
    setOpenMenuKeys((current) => {
      const next = current.includes('font-layouts') ? current : [...current, 'font-layouts'];
      if (selectedFontLayoutsShopId === undefined) return next;
      const shopKey = getFontLayoutsShopMenuKey(selectedFontLayoutsShopId);
      return next.includes(shopKey) ? next : [...next, shopKey];
    });
  }, [activeModule, collapsed, selectedFontLayoutsShopId]);

  useEffect(() => {
    if (activeModule !== 'template-library' || collapsed) return;
    setOpenMenuKeys((current) => {
      const next = current.includes('template-library') ? current : [...current, 'template-library'];
      if (selectedTemplateLibraryProductId !== undefined) {
        const key = getProductMenuKey(selectedTemplateLibraryProductId);
        return next.includes(key) ? next : [...next, key];
      }
      return next;
    });
  }, [activeModule, collapsed, selectedTemplateLibraryProductId]);

  useEffect(() => {
    if (productEditor === undefined) return;
    productForm.resetFields();
    commonSpecUnitsRef.current = {};
    const editorCommonSpecs = productEditor?.commonSpecValues ?? [];
    const shouldUseSpineWidthFormula = productEditor?.spineWidthMode === 'formula' || Boolean(productEditor?.spineWidthFormula);
    setProductNames(productEditor?.productNames ?? []);
    setProductDraft('');
    setProductInputVisible(false);
    productForm.setFieldsValue({
      bleedMode: productEditor?.commonSpecValues?.some((value) => typeof value.bleed === 'object') ? 'double' : 'single',
      spineWidthMode: productEditor?.spineWidthMode ?? (productEditor?.spineWidthFormula ? 'formula' : 'range'),
      useSafeDistance: productEditor?.useSafeDistance ?? true,
      backCoverSafeDistance: productEditor?.backCoverSafeDistance ?? emptySafeDistance(),
      coverSafeDistance: productEditor?.coverSafeDistance ?? emptySafeDistance(),
      spineSafeDistance: productEditor?.spineSafeDistance ?? emptySafeDistance()
    });
    productForm.resetFields(['spineWidthFormula']);
    if (shouldUseSpineWidthFormula) {
      productForm.setFieldsValue({
        spineWidthFormula: productEditor?.spineWidthFormula ?? { ...defaultSpineWidthFormula }
      });
    }
    const initialPageRules = productEditor?.spineWidthPageRules ?? { ...defaultSpineWidthPageRules, items: defaultSpineWidthPageRules.items.map(item => ({ ...item })) };
    productForm.setFieldsValue({
      spineWidthPageRules: { ...initialPageRules, matchStrategy: 'exact' }
    });
    const firstCommonSpec = productEditor?.commonSpecValues?.[0];
    const initialPageCount = firstCommonSpec?.pageCount > 0 ? firstCommonSpec.pageCount : undefined;
    const initialPageCountOptions = firstCommonSpec?.pageCountOptions?.length ? firstCommonSpec.pageCountOptions : undefined;
    productForm.setFieldsValue({
      ...(initialPageCount !== undefined ? { defaultPageCount: initialPageCount } : {}),
      ...(initialPageCountOptions ? { pageCountOptions: initialPageCountOptions } : {})
    });
    commonSpecUnitsRef.current = Object.fromEntries(
      (productEditor?.commonSpecValues ?? []).map((value, index) => [
        String(index),
        value.unit === 'mm' || value.unit === 'cm' ? value.unit : 'in'
      ])
    );
    if (productEditor) productForm.setFieldsValue({
      name: productEditor.name,
      templateMarker: productEditor.templateMarker,
      innerPageField: productEditor.innerPageField,
      productIdentifiers: productEditor.productIdentifiers,
      description: productEditor.description,
      specifications: productEditor.specifications,
      specificationField: productEditor.specificationField,
      commonSpecValues: editorCommonSpecs.map((value) => ({
        ...value,
        label: value.label || value.id,
        pageCount: value.pageCount > 0 ? value.pageCount : value.pageCountOptions[0] ?? 50,
        spineWidthMode: value.spineWidthMode,
        bleed: normalizeProductBleed(value.bleed, productEditor.commonSpecValues.some((item) => typeof item.bleed === 'object') ? 'double' : 'single')
      })),
      shopIds: productEditor.shopIds
    });
  }, [productEditor, productForm]);

  function addProductName() {
    const nextProduct = productDraft.trim();
    if (!nextProduct) return;
    if (productNames.includes(nextProduct)) {
      message.warning('该商品已添加');
      return;
    }
    setProductNames((current) => [...current, nextProduct]);
    setProductDraft('');
    setProductInputVisible(false);
  }

  function changeProductBleedMode(nextMode: 'single' | 'double') {
    const current = productForm.getFieldValue('commonSpecValues');
    if (Array.isArray(current)) {
      productForm.setFieldValue(
        'commonSpecValues',
        current.map((value: Partial<ProductCommonSpecValue>) => ({
          ...value,
          bleed: normalizeProductBleed(value.bleed, nextMode),
          ...(nextMode === 'double' ? {
            spineWidth: 0,
            minSpineWidth: 0,
            maxSpineWidth: 0,
            spineBleed: 0,
            paperThickness: 0
          } : {})
        }))
      );
    }
    productForm.setFieldValue('bleedMode', nextMode);
  }

  function changeSpineWidthMode(nextMode: ProductSpineWidthMode) {
    productForm.setFieldValue('spineWidthMode', nextMode);
    // Formula mode owns the final width calculation.  Any existing range-mode
    // spine bleed is not meaningful there, so start the editable formula bleed
    // field from the documented default of 0.
    if (nextMode === 'formula') {
      const current = productForm.getFieldValue('commonSpecValues');
      if (Array.isArray(current)) {
        productForm.setFieldValue('commonSpecValues', current.map((value: Partial<ProductCommonSpecValue>) => ({
          ...value,
          spineBleed: 0
        })));
      }
    }
    if (nextMode === 'formula' && !productForm.getFieldValue('spineWidthFormula')) {
      productForm.setFieldValue('spineWidthFormula', { ...defaultSpineWidthFormula });
    }
    if (nextMode === 'page_count_table' && !productForm.getFieldValue('spineWidthPageRules')) {
      productForm.setFieldValue('spineWidthPageRules', { ...defaultSpineWidthPageRules, items: defaultSpineWidthPageRules.items.map(item => ({ ...item })) });
    }
  }

  return (
    <Layout className={editorMode ? 'app-shell app-shell-editor' : 'app-shell'}>
      <Sider
        className="app-sider"
        width={240}
        collapsedWidth={72}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        trigger={null}
        onCollapse={setCollapsed}
      >
        <div className={collapsed ? 'brand brand-collapsed' : 'brand'}>
          <span className="brand-mark">A</span>
          {!collapsed && (
            <div className="brand-copy">
              <strong>排版管理</strong>
              <small>订单模板生产工具</small>
            </div>
          )}
        </div>

        <Menu
          className="sidebar-menu"
          mode="inline"
          selectedKeys={[selectedMenuKey]}
          openKeys={openMenuKeys}
          items={menuItems}
          onOpenChange={(keys) => setOpenMenuKeys(keys)}
          onClick={({ key }) => {
            if (isProductAddMenuKey(key)) {
              onOpenProductEditor(null);
              return;
            }
            const productSelection = getProductMenuSelection(key);
            if (productSelection) {
              onTemplateLibrarySelection(productSelection.productId, productSelection.shopId);
              onModuleChange('template-library');
              return;
            }
            const innerPagesSelection = getInnerPagesMenuSelection(key);
            if (innerPagesSelection) {
              onInnerPagesSelection(innerPagesSelection.shopId, innerPagesSelection.productId);
              onModuleChange('inner-pages');
              return;
            }
            const fontLayoutsSelection = getFontLayoutsMenuSelection(key);
            if (fontLayoutsSelection) {
              onFontLayoutsSelection(fontLayoutsSelection.shopId, fontLayoutsSelection.productId);
              onModuleChange('font-layouts');
              return;
            }
            const shopId = getSizeTemplateShopIdFromMenuKey(key);
            if (shopId !== undefined) {
              onClearTemplateLibraryContext();
              onSizeTemplatesShopChange(shopId);
              onModuleChange('size-templates');
              return;
            }
            if (key === 'size-templates') onClearTemplateLibraryContext();
            onModuleChange(key as ModuleId);
          }}
        />

        {!collapsed && <div className="status">{status}</div>}
      </Sider>

      <Layout className="app-main">
        <Header className={`app-content-header weather-tone-${weatherTone}`}>
          <div className="app-header-background" aria-hidden="true" />
          <Tooltip title={collapsed ? '展开侧边导航' : '收起侧边导航'}>
            <Button
              aria-label={collapsed ? '展开侧边导航' : '收起侧边导航'}
              aria-pressed={collapsed}
              className={`app-nav-toggle ${collapsed ? 'is-collapsed' : 'is-expanded'}`}
              type="text"
              onClick={() => setCollapsed((current) => !current)}
            >
              <span className="app-nav-toggle-icon" aria-hidden="true">
                <LeftOutlined className="app-nav-toggle-icon-expanded" />
                <RightOutlined className="app-nav-toggle-icon-collapsed" />
              </span>
            </Button>
          </Tooltip>
          <div className="app-breadcrumb-context">
            <div className="app-breadcrumb-content">
              <Breadcrumb aria-label="当前位置" className="app-breadcrumb" items={breadcrumbItems} />
            </div>
            <WeatherBreadcrumb onToneChange={setWeatherTone} />
          </div>
          <div className="app-header-actions">
            <Dropdown
              trigger={['click']}
              menu={{ items: [{ key: 'empty', label: '暂无新通知', disabled: true }] }}
            >
              <Badge dot offset={[-3, 4]}>
                <Button type="text" className="app-header-icon-button" aria-label="消息通知" icon={<BellOutlined />} />
              </Badge>
            </Dropdown>
            <Dropdown
              trigger={['click']}
              menu={{
                items: accountMenuItems,
                onClick: ({ key }) => { if (key === 'account') onModuleChange('account'); }
              }}
            >
              <Button type="text" className="app-user-button" aria-label="打开用户菜单">
                <Avatar size={30} className="app-user-avatar">{accountInitials}</Avatar>
                <span className="app-user-name">{accountName}</span>
                <DownOutlined className="app-user-chevron" aria-hidden="true" />
              </Button>
            </Dropdown>
          </div>
        </Header>

        <Content className={editorMode ? 'workspace workspace-editor' : 'workspace'}>
          {children}
        </Content>
      </Layout>
      <Modal
        title={productEditor ? '编辑产品分类' : '添加产品分类'}
        width={720}
        open={productEditor !== undefined}
        okText="保存"
        cancelText="取消"
        confirmLoading={productSubmitting}
        okButtonProps={{ disabled: productSubmitting }}
        cancelButtonProps={{ disabled: productSubmitting }}
        closable={!productSubmitting}
        maskClosable={!productSubmitting}
        onCancel={() => { if (!productSubmittingRef.current) onCloseProductEditor(); }}
        onOk={() => { if (!productSubmittingRef.current) void productForm.submit(); }}
        destroyOnClose
      >
        <Spin spinning={productSubmitting} tip="正在保存...">
        <Form form={productForm} layout="vertical" onFinish={async (values) => {
          if (productSubmittingRef.current) return;
          if (productNames.length === 0) {
            message.error('至少添加一个商品名称');
            return;
          }
          productSubmittingRef.current = true;
          setProductSubmitting(true);
          try {
            const submittedSpineWidthMode: ProductSpineWidthMode = values.spineWidthMode === 'formula' || values.spineWidthMode === 'page_count_table' ? values.spineWidthMode : 'range';
            const submittedSpineWidthFormulaBase = submittedSpineWidthMode === 'formula' ? normalizedSpineWidthFormula(values.spineWidthFormula) : undefined;
            const submittedSpineWidthPageRules = submittedSpineWidthMode === 'page_count_table' ? normalizedSpineWidthPageRules(values.spineWidthPageRules) : undefined;
            const normalizedSpecs = Array.isArray(values.commonSpecValues)
              ? values.commonSpecValues
                .map((value: Partial<ProductCommonSpecValue>) => normalizedCommonSpecValue({
                  ...value,
                  pageCount: Number(values.defaultPageCount) > 0 ? Number(values.defaultPageCount) : 50,
                  pageCountOptions: Array.isArray(values.pageCountOptions) ? values.pageCountOptions : [50, 100],
                }, submittedSpineWidthFormulaBase, values.bleedMode === 'double' ? 'double' : 'single', submittedSpineWidthMode, submittedSpineWidthPageRules))
                .filter((value) => value.id || value.label)
              : [];
            const submittedSpineWidthFormula = submittedSpineWidthFormulaBase
              ? { ...submittedSpineWidthFormulaBase, spineBleed: Number(normalizedSpecs[0]?.spineBleed) || submittedSpineWidthFormulaBase.spineBleed }
              : undefined;
            await onSaveProduct(productEditor?.id, {
              name: String(values.name ?? '').trim(),
              templateMarker: String(values.templateMarker ?? '').trim(),
              innerPageField: String(values.innerPageField ?? '').trim(),
              productIdentifiers: Array.isArray(values.productIdentifiers) ? values.productIdentifiers.map(String).map((item) => item.trim()).filter(Boolean) : [],
              useSafeDistance: values.useSafeDistance !== false,
              description: String(values.description ?? ''),
              productNames,
              specifications: Array.isArray(values.specifications)
                ? values.specifications.map(String).map((item) => item.trim()).filter(Boolean)
                : [],
              specificationField: String(values.specificationField ?? '').trim(),
              commonSpecValues: normalizedSpecs,
              spineWidthMode: submittedSpineWidthMode,
              ...(submittedSpineWidthFormula ? { spineWidthFormula: submittedSpineWidthFormula } : {}),
              ...(submittedSpineWidthPageRules ? { spineWidthPageRules: submittedSpineWidthPageRules } : {}),
              backCoverSafeDistance: normalizedSafeDistance(values.backCoverSafeDistance),
              coverSafeDistance: normalizedSafeDistance(values.coverSafeDistance),
              spineSafeDistance: normalizedSafeDistance(values.spineSafeDistance),
              shopIds: Array.isArray(values.shopIds) ? values.shopIds.map(Number).filter(Number.isInteger) : [],
              enabled: true
            });
            onCloseProductEditor();
          } catch (error) {
            message.error(error instanceof Error ? error.message : String(error));
          } finally {
            productSubmittingRef.current = false;
            setProductSubmitting(false);
          }
        }}>
          <Form.Item name="name" label="产品分类名称" rules={[{ required: true, whitespace: true, message: '请输入产品分类名称' }]}><Input placeholder="例如：婚礼签到册" /></Form.Item>
          <Form.Item name="shopIds" label="关联店铺"><Select mode="multiple" options={shops.map((shop) => ({ value: shop.id, label: shop.shopName || shop.shop || '未命名店铺' }))} placeholder="选择关联店铺" /></Form.Item>
          <Form.Item name="specificationField" label="规格匹配字段" extra="此产品在购买页面选择规则字段，没有规格不填">
            <Input placeholder="商品规格字段" />
          </Form.Item>
          <Form.Item name="templateMarker" label="模板标识" extra="此产品在购买页面选择模板的字段"><Input placeholder="请输入模板标识（选填）" /></Form.Item>
          <Form.Item name="innerPageField" label="内页字段" extra="有内页的商品请输入商品在购买页面的内页字段"><Input placeholder="请输入内页字段（选填）" /></Form.Item>
          <Form.Item name="productIdentifiers" label="产品标识"><Select mode="tags" tokenSeparators={[',', '，']} placeholder="输入产品标识后按回车添加" /></Form.Item>
          <Form.Item name="useSafeDistance" label="启用安全距离" valuePropName="checked" extra="开启后，编辑区会显示红色安全距离警示框；关闭后不渲染安全距离，也不会在保存时检测。"><Switch /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="商品名称" extra="输入商品名称后按回车或点击加号；点击标签内减号可删除。">
            <div className="shop-product-editor">
              <div className="shop-product-tags">
                {productNames.map((product) => (
                  <Tag className="shop-product-tag" key={product}>
                    <span>{product}</span>
                    <button type="button" className="shop-product-remove" aria-label={`删除商品 ${product}`} onClick={() => setProductNames((current) => current.filter((item) => item !== product))}><MinusOutlined /></button>
                  </Tag>
                ))}
                {productInputVisible ? (
                  <Input className="shop-product-inline-input" autoFocus value={productDraft} placeholder="商品名称" onBlur={() => { if (productDraft.trim()) addProductName(); else setProductInputVisible(false); }} onChange={(event) => setProductDraft(event.target.value)} onPressEnter={(event) => { event.preventDefault(); addProductName(); }} />
                ) : (
                  <Tag className="shop-product-add-tag" role="button" tabIndex={0} onClick={() => setProductInputVisible(true)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setProductInputVisible(true); }}><PlusOutlined /> 添加商品</Tag>
                )}
              </div>
            </div>
          </Form.Item>
          <Form.Item name="specifications" label="商品规格">
            <Select mode="tags" tokenSeparators={[',', '，']} placeholder="输入规格后按回车，例如 9×6" />
          </Form.Item>
          <Form.Item name="bleedMode" label="出血控制" extra="单排使用数值出血；双排使用接口返回的四边 bleed 对象">
            <Segmented disabled={Boolean(productEditor)} block options={[{ value: 'single', label: '单排' }, { value: 'double', label: '双排' }]} onChange={(value) => changeProductBleedMode(value === 'double' ? 'double' : 'single')} />
          </Form.Item>
          <Form.Item name="spineWidthMode" label="背脊宽依据" extra={productEditor ? '编辑产品时不可修改背脊宽依据' : '选择依据后填写对应参数'}>
            <Select
              disabled={Boolean(productEditor)}
              options={[
                { value: 'range', label: '固定范围' },
                { value: 'formula', label: '产品公式' },
                { value: 'page_count_table', label: '按页数分段' },
              ]}
              onChange={(value: ProductSpineWidthMode) => changeSpineWidthMode(value)}
            />
          </Form.Item>
          <Form.Item name="defaultPageCount" label="默认页数"><InputNumber min={1} precision={0} placeholder="请输入默认页数" /></Form.Item>
          <Form.Item name="pageCountOptions" label="页数选项"><Select mode="tags" tokenSeparators={[',', '，']} placeholder="输入后按回车添加" /></Form.Item>
          {showProductSpineWidthFormula && productUsesSpineWidthFormula ? (
            <div className="product-spine-width-formula-editor">
              <Typography.Title level={5}>产品公式</Typography.Title>
              <Typography.Text type="secondary">最终背脊宽会根据默认页数实时计算。</Typography.Text>
              <div className="product-common-spec-grid">
                <Form.Item name={['spineWidthFormula', 'unit']} label="公式单位"><Select options={[{ value: 'cm', label: 'cm' }, { value: 'mm', label: 'mm' }, { value: 'in', label: 'in' }]} /></Form.Item>
                <Form.Item name={['spineWidthFormula', 'pageCountCoefficient']} label="页数系数"><InputNumber min={0} /></Form.Item>
                <Form.Item name={['spineWidthFormula', 'pageCountThickness']} label="每页厚度"><InputNumber min={0} /></Form.Item>
                <Form.Item name={['spineWidthFormula', 'baseWidth']} label="基础宽度"><InputNumber min={0} /></Form.Item>
                <Form.Item name={['spineWidthFormula', 'additionalWidth']} label="附加宽度"><InputNumber min={0} /></Form.Item>
              </div>
            </div>
          ) : null}
          {showProductSpineWidthPageRules ? (
            <div className="product-spine-width-formula-editor">
              <Typography.Title level={5}>按页数分段规则</Typography.Title>
              <Typography.Text type="secondary">根据页数匹配对应的背脊宽和背脊出血。</Typography.Text>
              <div className="product-common-spec-grid">
                <Form.Item name={['spineWidthPageRules', 'unit']} label="规则单位"><Select options={[{ value: 'cm', label: 'cm' }, { value: 'mm', label: 'mm' }, { value: 'in', label: 'in' }]} onChange={(nextUnit: SpineWidthPageRules['unit']) => {
                  const current = productForm.getFieldValue('spineWidthPageRules') as SpineWidthPageRules | undefined;
                  if (current) productForm.setFieldValue('spineWidthPageRules', convertSpineWidthPageRulesUnit(current, nextUnit));
                }} /></Form.Item>
                <Form.Item name={['spineWidthPageRules', 'matchStrategy']} label="匹配方式"><Select disabled defaultValue="exact" options={[{ value: 'exact', label: '精确匹配' }]} /></Form.Item>
              </div>
              <Form.List name={['spineWidthPageRules', 'items']}>
                {(fields, { add, remove }) => (
                  <div className="product-common-spec-editor">
                    {fields.map(field => (
                      <div className="product-common-spec-row" key={field.key}>
                        <div className="product-common-spec-grid">
                          <Form.Item name={[field.name, 'pageCount']} label="页数"><InputNumber min={1} precision={0} /></Form.Item>
                          <Form.Item name={[field.name, 'spineWidth']} label="背脊宽"><InputNumber min={0} /></Form.Item>
                          <Form.Item name={[field.name, 'spineBleed']} label="背脊出血"><InputNumber min={0} /></Form.Item>
                          <Button type="text" danger icon={<DeleteOutlined />} aria-label="删除页数规则" onClick={() => remove(field.name)} />
                        </div>
                      </div>
                    ))}
                    <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ pageCount: 50, spineWidth: 0, spineBleed: 0 })}>添加页数规则</Button>
                  </div>
                )}
              </Form.List>
            </div>
          ) : null}
          <Form.Item label="常用规格值">
            <Form.List name="commonSpecValues">
              {(fields, { add, remove }) => (
                <div className="product-common-spec-editor">
                  {fields.map((field, index) => {
                    const rowKey = String(field.key);
                    const rowIndex = Number(field.name);
                    const rowValue = commonSpecValues?.[rowIndex] ?? {};
                    const finalSpineWidth = spineWidthMode === 'formula'
                      ? resolveImageMapSpineWidth({
                        ...rowValue,
                        bleed: typeof rowValue.bleed === 'number' ? rowValue.bleed : Number(rowValue.bleed?.left ?? rowValue.bleed?.right ?? 0),
                        pageCount: defaultPageCount,
                        pageCountOptions: commonPageCountOptions,
                        spineWidthMode: 'by_page_count',
                        spineWidthFormula,
                      })
                      : spineWidthMode === 'page_count_table'
                        ? (() => {
                          const rule = matchedSpineWidthPageRule(spineWidthPageRules, defaultPageCount);
                          const rowUnit = rowValue.unit === 'mm' || rowValue.unit === 'cm' ? rowValue.unit : 'in';
                          return rule ? convertSpineRuleValue(rule.spineWidth, spineWidthPageRules?.unit ?? rowUnit, rowUnit) : Number(rowValue.spineWidth) || 0;
                        })()
                      : Number(rowValue.spineWidth) || 0;
                    if (!commonSpecUnitsRef.current[rowKey]) {
                      const rowValue = productForm.getFieldValue(['commonSpecValues', field.name]) as Partial<ProductCommonSpecValue> | undefined;
                      commonSpecUnitsRef.current[rowKey] = rowValue?.unit === 'mm' || rowValue?.unit === 'cm' ? rowValue.unit : 'in';
                    }
                    return (
                      <div className="product-common-spec-row" key={field.key}>
                        <div className="product-common-spec-row-head">
                          <Typography.Text strong>规格 {index + 1}</Typography.Text>
                          <Button type="text" danger icon={<DeleteOutlined />} aria-label={`删除规格 ${index + 1}`} onClick={() => remove(field.name)} />
                        </div>
                        <div className="product-common-spec-grid">
                          <Form.Item
                            name={[field.name, 'label']}
                            label="显示名称"
                            extra="显示名称同时作为规格 ID，保存后请勿随意修改。"
                            rules={[{
                              validator: async (_, value) => {
                                const row = productForm.getFieldValue(['commonSpecValues', field.name]) as Partial<ProductCommonSpecValue> | undefined;
                                if (hasCommonSpecValue(row) && !String(value ?? '').trim()) throw new Error('填写规格参数后请输入显示名称');
                              }
                            }]}
                          ><Input placeholder="9*6" /></Form.Item>
                          <Form.Item name={[field.name, 'unit']} label="单位"><Select options={[{ value: 'in', label: 'in' }, { value: 'cm', label: 'cm' }, { value: 'mm', label: 'mm' }]} onChange={(nextUnit: ProductCommonSpecValue['unit']) => {
                            const current = productForm.getFieldValue(['commonSpecValues', field.name]) as Partial<ProductCommonSpecValue> | undefined;
                            const previousUnit = commonSpecUnitsRef.current[rowKey]
                              ?? (current?.unit === 'mm' || current?.unit === 'cm' ? current.unit : 'in');
                            commonSpecUnitsRef.current[rowKey] = nextUnit;
                            productForm.setFieldValue(['commonSpecValues', field.name], convertCommonSpecUnit(current ?? {}, previousUnit, nextUnit));
                          }} /></Form.Item>
                          <Form.Item name={[field.name, 'sideWidth']} label="单面宽"><InputNumber min={0} /></Form.Item>
                          <Form.Item name={[field.name, 'sideHeight']} label="单面高"><InputNumber min={0} /></Form.Item>
                          {productBleedMode === 'single' ? (
                            <Form.Item name={[field.name, 'bleed']} label="出血"><InputNumber min={0} /></Form.Item>
                          ) : (
                            <>
                              <Form.Item name={[field.name, 'bleed', 'top']} label="出血上"><InputNumber min={0} /></Form.Item>
                              <Form.Item name={[field.name, 'bleed', 'bottom']} label="出血下"><InputNumber min={0} /></Form.Item>
                              <Form.Item name={[field.name, 'bleed', 'left']} label="出血左"><InputNumber min={0} /></Form.Item>
                              <Form.Item name={[field.name, 'bleed', 'right']} label="出血右"><InputNumber min={0} /></Form.Item>
                            </>
                          )}
                          {spineWidthMode === 'formula' ? (
                            <>
                              <Form.Item label="最终背脊宽">
                                <InputNumber value={finalSpineWidth} addonAfter={rowValue.unit || 'in'} precision={4} disabled style={{ width: '100%' }} />
                              </Form.Item>
                              <Form.Item name={[field.name, 'spineBleed']} label="背脊出血"><InputNumber min={0} /></Form.Item>
                            </>
                          ) : spineWidthMode === 'page_count_table' ? (
                            <Form.Item label="背脊宽">
                              <InputNumber value={Number(rowValue.spineWidth) || 0} addonAfter={rowValue.unit || 'in'} precision={4} disabled style={{ width: '100%' }} />
                            </Form.Item>
                          ) : (
                            <>
                              <Form.Item name={[field.name, 'spineWidth']} label="背脊宽"><InputNumber min={0} /></Form.Item>
                              <Form.Item name={[field.name, 'minSpineWidth']} label="最小背脊宽"><InputNumber min={0} /></Form.Item>
                              <Form.Item name={[field.name, 'maxSpineWidth']} label="最大背脊宽"><InputNumber min={0} /></Form.Item>
                              <Form.Item name={[field.name, 'spineBleed']} label="背脊出血"><InputNumber min={0} /></Form.Item>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({
                    ...defaultCommonSpecValue,
                    ...(spineWidthMode === 'formula' ? {
                      spineWidth: 0,
                      minSpineWidth: 0,
                      maxSpineWidth: 0,
                      spineBleed: 0,
                      paperThickness: 0
                    } : {}),
                    bleed: productBleedMode === 'double' ? emptyDoubleBleed(defaultCommonSpecValue.bleed as number) : defaultCommonSpecValue.bleed
                  })}>添加常用规格</Button>
                </div>
              )}
            </Form.List>
          </Form.Item>
          <div className="product-safe-distance-editor">
            <Typography.Title level={5}>安全距离（mm）</Typography.Title>
            <SafeDistanceFormFields label="封底安全距离" name="backCoverSafeDistance" />
            <SafeDistanceFormFields label="封面安全距离" name="coverSafeDistance" />
            <SafeDistanceFormFields label="背脊安全距离" name="spineSafeDistance" />
          </div>
        </Form>
        </Spin>
      </Modal>
    </Layout>
  );
}
