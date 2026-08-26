import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { App, Breadcrumb, Button, Form, Input, Layout, Menu, Modal, Select, Tag, Typography } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';
import type { ProductCategory, ProductCategoryPayload, Shop } from '@shared/domain';
import type { ModuleId } from '../modules/types';
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
    setProductNames(productEditor?.productNames ?? []);
    setProductDraft('');
    setProductInputVisible(false);
    if (productEditor) productForm.setFieldsValue({ name: productEditor.name, description: productEditor.description, shopIds: productEditor.shopIds });
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
        open={productEditor !== undefined}
        okText="保存"
        cancelText="取消"
        onCancel={onCloseProductEditor}
        onOk={() => { void productForm.submit(); }}
        destroyOnClose
      >
        <Form form={productForm} layout="vertical" onFinish={async (values) => {
          try {
            if (productNames.length === 0) {
              message.error('至少添加一个商品名称');
              return;
            }
            await onSaveProduct(productEditor?.id, {
              name: String(values.name ?? '').trim(),
              description: String(values.description ?? ''),
              productNames,
              shopIds: Array.isArray(values.shopIds) ? values.shopIds.map(Number).filter(Number.isInteger) : [],
              enabled: true
            });
            onCloseProductEditor();
          } catch (error) {
            message.error(error instanceof Error ? error.message : String(error));
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
          <Form.Item name="shopIds" label="关联店铺"><Select mode="multiple" options={shops.map((shop) => ({ value: shop.id, label: shop.shopName || shop.shop || '未命名店铺' }))} placeholder="选择关联店铺" /></Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
