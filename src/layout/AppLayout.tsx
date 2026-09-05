import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { App, Breadcrumb, Button, Form, Input, InputNumber, Layout, Menu, Modal, Select, Spin, Tag, Typography } from 'antd';
import { DeleteOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';
import type { ProductCategory, ProductCategoryPayload, ProductCommonSpecValue, SafeDistance, Shop, SpineWidthFormula } from '@shared/domain';
import type { ModuleId } from '../modules/types';
import { resolveImageMapSpineWidth } from '../image-map-editor/editors/imagemap/ImageMapSizeScheme';
import {
  getModuleDefinition,
  getModuleMenuItems,
  getInnerPagesMenuSelection,
  getInnerPagesProductMenuKey,
  getInnerPagesShopMenuKey,
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

const defaultSpineWidthFormula: SpineWidthFormula = {
  unit: 'cm',
  pageCountCoefficient: 0.2,
  pageCountThickness: 0.3,
  baseWidth: 1,
  additionalWidth: 0.9,
  spineBleed: 0
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

function normalizedCommonSpecValue(
  value: Partial<ProductCommonSpecValue>,
  formula?: SpineWidthFormula
): ProductCommonSpecValue {
  const pageCountOptions = Array.isArray(value.pageCountOptions)
    ? value.pageCountOptions.map(Number).filter((count) => Number.isFinite(count) && count > 0)
    : [];
  const pageCount = Number(value.pageCount) > 0
    ? Number(value.pageCount)
    : pageCountOptions[0] ?? 50;
  const spineWidthMode = value.spineWidthMode === 'by_page_count' ? 'by_page_count' : 'fixed';
  const usesFormula = Boolean(formula) && spineWidthMode === 'by_page_count';
  const spineWidth = usesFormula
    ? resolveImageMapSpineWidth({
      ...value,
      pageCount,
      pageCountOptions,
      spineWidthMode,
      spineWidthFormula: formula
    })
    : Number(value.spineWidth) || 0;
  return {
    label: String(value.label ?? '').trim(),
    id: String(value.label ?? '').trim(),
    unit: value.unit === 'mm' || value.unit === 'cm' ? value.unit : 'in',
    pageCount,
    pageCountOptions: pageCountOptions.length ? pageCountOptions : [pageCount],
    sideWidth: Number(value.sideWidth) || 0,
    sideHeight: Number(value.sideHeight) || 0,
    bleed: Number(value.bleed) || 0,
    spineWidthMode,
    spineWidth,
    minSpineWidth: usesFormula ? 0 : Number(value.minSpineWidth) || 0,
    maxSpineWidth: usesFormula ? 0 : Number(value.maxSpineWidth) || 0,
    spineBleed: usesFormula ? 0 : Number(value.spineBleed) || 0,
    paperThickness: usesFormula ? 0 : Number(value.paperThickness) || 0
  };
}

const unitToInches: Record<ProductCommonSpecValue['unit'], number> = {
  in: 1,
  cm: 1 / 2.54,
  mm: 1 / 25.4
};

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
  return converted;
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
  editorMode?: boolean;
  shops: Shop[];
  products: ProductCategory[];
  selectedSizeTemplatesShopId?: number;
  selectedTemplateLibraryProductId?: number;
  selectedTemplateLibraryShopId: TemplateLibraryShopSelection;
  selectedInnerPagesShopId?: number;
  selectedInnerPagesProductId?: number;
  status: string;
  onModuleChange(moduleId: ModuleId): void;
  onSizeTemplatesShopChange(shopId: number): void;
  onInnerPagesSelection(shopId: number, productId: number): void;
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
  editorMode = false,
  shops,
  products,
  selectedSizeTemplatesShopId,
  selectedTemplateLibraryProductId,
  selectedTemplateLibraryShopId,
  selectedInnerPagesShopId,
  selectedInnerPagesProductId,
  status,
  onModuleChange,
  onSizeTemplatesShopChange,
  onInnerPagesSelection,
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
  const [openMenuKeys, setOpenMenuKeys] = useState<string[]>([]);
  const [productForm] = Form.useForm();
  const [productNames, setProductNames] = useState<string[]>([]);
  const [productDraft, setProductDraft] = useState('');
  const [productInputVisible, setProductInputVisible] = useState(false);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const productSubmittingRef = useRef(false);
  const commonSpecUnitsRef = useRef<Record<string, ProductCommonSpecValue['unit']>>({});
  const commonSpecValues = Form.useWatch('commonSpecValues', productForm) as Partial<ProductCommonSpecValue>[] | undefined;
  const spineWidthFormula = Form.useWatch('spineWidthFormula', {
    form: productForm,
    preserve: true
  }) as SpineWidthFormula | undefined;
  const hasPageCountSpineRule = commonSpecValues?.some((value) => value?.spineWidthMode === 'by_page_count') === true;
  const productUsesSpineWidthFormula = Boolean(spineWidthFormula);
  const showProductSpineWidthFormula = hasPageCountSpineRule && productUsesSpineWidthFormula;
  const activeModuleDefinition = getModuleDefinition(activeModule);
  const productActions: ProductMenuActions = useMemo(() => ({ onAdd: () => onOpenProductEditor(null), onEdit: onOpenProductEditor, onDelete: (product) => { void onDeleteProduct(product); } }), [onDeleteProduct, onOpenProductEditor]);
  const menuItems = useMemo(() => getModuleMenuItems(shops, products, productActions), [shops, products, productActions]);
  const selectedMenuKey = activeModule === 'template-library' && selectedTemplateLibraryProductId !== undefined
    ? (selectedTemplateLibraryShopId !== 'ALL' ? getProductShopMenuKey(selectedTemplateLibraryProductId, selectedTemplateLibraryShopId) : getProductAllMenuKey(selectedTemplateLibraryProductId))
    : activeModule === 'size-templates' && selectedSizeTemplatesShopId !== undefined
    ? getSizeTemplateShopMenuKey(selectedSizeTemplatesShopId)
    : activeModule === 'inner-pages' && selectedInnerPagesShopId !== undefined && selectedInnerPagesProductId !== undefined
      ? getInnerPagesProductMenuKey(selectedInnerPagesShopId, selectedInnerPagesProductId)
    : activeModule;
  const breadcrumbItems = useMemo(
    () => activeModuleDefinition.breadcrumb.map((title) => ({ title })),
    [activeModuleDefinition]
  );

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
    const shouldUseSpineWidthFormula = Boolean(productEditor?.spineWidthFormula)
      || editorCommonSpecs.some((value) => value.spineWidthMode === 'by_page_count');
    setProductNames(productEditor?.productNames ?? []);
    setProductDraft('');
    setProductInputVisible(false);
    productForm.setFieldsValue({
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
    commonSpecUnitsRef.current = Object.fromEntries(
      (productEditor?.commonSpecValues ?? []).map((value, index) => [
        String(index),
        value.unit === 'mm' || value.unit === 'cm' ? value.unit : 'in'
      ])
    );
    if (productEditor) productForm.setFieldsValue({
      name: productEditor.name,
      description: productEditor.description,
      specifications: productEditor.specifications,
      specificationField: productEditor.specificationField,
      commonSpecValues: editorCommonSpecs.map((value) => ({
        ...value,
        label: value.label || value.id,
        pageCount: value.pageCount > 0 ? value.pageCount : value.pageCountOptions[0] ?? 50,
        spineWidthMode: value.spineWidthMode
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
        <Header className="app-content-header">
          <Button
            aria-label={collapsed ? '展开侧边导航' : '收起侧边导航'}
            className="app-nav-toggle"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            type="text"
            onClick={() => setCollapsed((current) => !current)}
          />
          <Breadcrumb className="app-breadcrumb" items={breadcrumbItems} />
          <Typography.Text className="app-module-title">{activeModuleDefinition.label}</Typography.Text>
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
            const submittedSpineWidthFormula = normalizedSpineWidthFormula(values.spineWidthFormula);
            await onSaveProduct(productEditor?.id, {
              name: String(values.name ?? '').trim(),
              description: String(values.description ?? ''),
              productNames,
              specifications: Array.isArray(values.specifications)
                ? values.specifications.map(String).map((item) => item.trim()).filter(Boolean)
                : [],
              specificationField: String(values.specificationField ?? '').trim(),
              commonSpecValues: Array.isArray(values.commonSpecValues)
                ? values.commonSpecValues
                  .map((value: Partial<ProductCommonSpecValue>) => normalizedCommonSpecValue(value, submittedSpineWidthFormula))
                  .filter((value) => value.id || value.label)
                : [],
              ...(submittedSpineWidthFormula ? { spineWidthFormula: submittedSpineWidthFormula } : {}),
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
          <Form.Item label="常用规格值">
            <Form.List name="commonSpecValues">
              {(fields, { add, remove }) => (
                <div className="product-common-spec-editor">
                  {fields.map((field, index) => {
                    const rowKey = String(field.key);
                    const rowIndex = Number(field.name);
                    const rowValue = commonSpecValues?.[rowIndex] ?? {};
                    const rowSpineMode = rowValue.spineWidthMode === 'by_page_count' ? 'by_page_count' : 'fixed';
                    const finalSpineWidth = rowSpineMode === 'by_page_count'
                      ? resolveImageMapSpineWidth({ ...rowValue, spineWidthFormula })
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
                          <Form.Item name={[field.name, 'pageCount']} label="页数"><InputNumber min={0} precision={0} /></Form.Item>
                          <Form.Item name={[field.name, 'pageCountOptions']} label="页数选项"><Select mode="tags" tokenSeparators={[',', '，']} /></Form.Item>
                          <Form.Item name={[field.name, 'sideWidth']} label="单面宽"><InputNumber min={0} /></Form.Item>
                          <Form.Item name={[field.name, 'sideHeight']} label="单面高"><InputNumber min={0} /></Form.Item>
                          <Form.Item name={[field.name, 'bleed']} label="出血"><InputNumber min={0} /></Form.Item>
                          <Form.Item name={[field.name, 'spineWidthMode']} label="背脊规则"><Select options={[{ value: 'fixed', label: '固定' }, { value: 'by_page_count', label: '按页数' }]} onChange={(mode) => {
                            if (mode !== 'by_page_count') return;
                            productForm.setFieldsValue({
                              spineWidthFormula: productForm.getFieldValue('spineWidthFormula') ?? { ...defaultSpineWidthFormula },
                            });
                          }} /></Form.Item>
                          {rowSpineMode === 'by_page_count' && productUsesSpineWidthFormula ? (
                            <Form.Item label="最终背脊宽">
                              <InputNumber value={finalSpineWidth} addonAfter={rowValue.unit || 'in'} precision={4} disabled style={{ width: '100%' }} />
                            </Form.Item>
                          ) : (
                            <>
                              <Form.Item name={[field.name, 'spineWidth']} label="背脊宽"><InputNumber min={0} /></Form.Item>
                              <Form.Item name={[field.name, 'minSpineWidth']} label="最小背脊宽"><InputNumber min={0} /></Form.Item>
                              <Form.Item name={[field.name, 'maxSpineWidth']} label="最大背脊宽"><InputNumber min={0} /></Form.Item>
                              <Form.Item name={[field.name, 'spineBleed']} label="背脊出血"><InputNumber min={0} /></Form.Item>
                            </>
                          )}
                          <Form.Item noStyle shouldUpdate={(previous, current) => previous.commonSpecValues?.[field.name]?.spineWidthMode !== current.commonSpecValues?.[field.name]?.spineWidthMode}>
                            {() => productForm.getFieldValue(['commonSpecValues', field.name, 'spineWidthMode']) === 'by_page_count' && productUsesSpineWidthFormula ? null : <Form.Item name={[field.name, 'paperThickness']} label="纸张厚度(mm)"><InputNumber min={0} /></Form.Item>}
                          </Form.Item>
                        </div>
                      </div>
                    );
                  })}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({
                    ...defaultCommonSpecValue
                  })}>添加常用规格</Button>
                </div>
              )}
            </Form.List>
          </Form.Item>
          {showProductSpineWidthFormula && productUsesSpineWidthFormula ? (
            <div className="product-spine-width-formula-editor">
              <Typography.Title level={5}>按页数背脊宽公式</Typography.Title>
              <Typography.Text type="secondary">背脊宽 = 页数 × 系数 × 每页厚度 + 基础宽度 + 附加宽度；公式结果会自动换算到规格单位。</Typography.Text>
              <div className="product-common-spec-grid">
                <Form.Item name={['spineWidthFormula', 'unit']} label="公式单位"><Select options={[{ value: 'cm', label: 'cm' }, { value: 'mm', label: 'mm' }, { value: 'in', label: 'in' }]} /></Form.Item>
                <Form.Item name={['spineWidthFormula', 'pageCountCoefficient']} label="页数系数"><InputNumber min={0} precision={4} /></Form.Item>
                <Form.Item name={['spineWidthFormula', 'pageCountThickness']} label="每页厚度"><InputNumber min={0} precision={4} /></Form.Item>
                <Form.Item name={['spineWidthFormula', 'baseWidth']} label="基础宽度"><InputNumber min={0} precision={4} /></Form.Item>
                <Form.Item name={['spineWidthFormula', 'additionalWidth']} label="附加宽度"><InputNumber min={0} precision={4} /></Form.Item>
                <Form.Item name={['spineWidthFormula', 'spineBleed']} label="背脊出血"><InputNumber value={0} disabled /></Form.Item>
              </div>
            </div>
          ) : null}
          <Form.Item name="specificationField" label="规格匹配字段">
            <Input placeholder="商品规格字段" />
          </Form.Item>
          <div className="product-safe-distance-editor">
            <Typography.Title level={5}>安全距离（mm）</Typography.Title>
            <SafeDistanceFormFields label="封底安全距离" name="backCoverSafeDistance" />
            <SafeDistanceFormFields label="封面安全距离" name="coverSafeDistance" />
            <SafeDistanceFormFields label="背脊安全距离" name="spineSafeDistance" />
          </div>
          <Form.Item name="shopIds" label="关联店铺"><Select mode="multiple" options={shops.map((shop) => ({ value: shop.id, label: shop.shopName || shop.shop || '未命名店铺' }))} placeholder="选择关联店铺" /></Form.Item>
        </Form>
        </Spin>
      </Modal>
    </Layout>
  );
}
