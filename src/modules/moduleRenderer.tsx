import type { ReactNode } from 'react';
import type {
  ExportHistoryEntry,
  LocalUserProfile,
  Order,
  OrderListFilters,
  OrderStatusDefinition,
  Shop,
} from '@shared/domain';
import AccountPage from './account';
import ImageMapEditorTestPage from './imageMapEditorTest/ImageMapEditorTestPage';
import ExportsPage from './exports';
import OrdersPage from './orders';
import OrderTemplateEditorPage from './orders/OrderTemplateEditorPage';
import ShopsPage from './shops';
import SizeTemplatesPage from './sizeTemplates';
import FontsPage from './fonts/FontsPage';
import TemplateLibraryPage from './templates/TemplateLibraryPage';
import InnerPagesPage from './innerPages/InnerPagesPage';
import TextGenerationRulesPage from './textGenerationRules/TextGenerationRulesPage';
import type { ModuleId } from './types';
import type { TemplateLibraryShopSelection } from './moduleRegistry';
import type { CatalogSizeTemplate, ProductCategory } from '@shared/domain';

type ModuleRenderContext = {
  account?: LocalUserProfile;
  exports: ExportHistoryEntry[];
  loadError: string;
  loading: boolean;
  openOrderInEditor(order: Order): void;
  orderTemplateEditorOrder?: Order;
  saveOrderTemplate(order: Order, templateJson: Record<string, unknown>): Promise<void>;
  closeOrderTemplateEditor(): void;
  orders: Order[];
  orderTotal: number;
  orderLimit: number;
  orderPage: number;
  orderStatuses: OrderStatusDefinition[];
  orderFilters: OrderListFilters;
  openShopOrders(shop: Shop, status?: number): void;
  openShopSizeTemplates(shop: Shop): void;
  reloadOrders(filters?: OrderListFilters): Promise<void>;
  reloadShops(): Promise<void>;
  selectedOrder?: Order;
  selectedOrderId: string;
  setAccount(account: LocalUserProfile): void;
  setSelectedOrderId(orderId: string): void;
  setStatus(message: string): void;
  shops: Shop[];
  shopsError: string;
  shopsLoading: boolean;
  selectedSizeTemplatesShopId?: number;
  selectedSizeTemplateId?: number;
  selectedInnerPagesShopId?: number;
  selectedInnerPagesProductId?: number;
  products: ProductCategory[];
  selectedTemplateLibraryProductId?: number;
  selectedTemplateLibraryShopId: TemplateLibraryShopSelection;
  openTemplateLibraryTemplate(template: CatalogSizeTemplate): void;
  createProduct(): void;
  editProduct(product: ProductCategory): void;
  deleteProduct(product: ProductCategory): void;
  setTemplateLibraryEditorMode(editing: boolean): void;
  setInnerPagesEditorMode(editing: boolean): void;
};

export function renderActiveModule(activeModule: ModuleId, context: ModuleRenderContext): ReactNode {
  if (activeModule === 'orders') {
    return (
      <OrdersPage
        orders={context.orders}
        orderTotal={context.orderTotal}
        orderLimit={context.orderLimit}
        orderPage={context.orderPage}
        orderStatuses={context.orderStatuses}
        shops={context.shops}
        filters={context.orderFilters}
        selectedOrderId={context.selectedOrderId}
        loading={context.loading}
        loadError={context.loadError}
        reloadOrders={context.reloadOrders}
        setSelectedOrderId={context.setSelectedOrderId}
        openOrderInEditor={context.openOrderInEditor}
      />
    );
  }

  if (activeModule === 'editor') {
    if (context.orderTemplateEditorOrder) {
      return (
        <OrderTemplateEditorPage
          order={context.orderTemplateEditorOrder}
          shops={context.shops}
          saveTemplate={context.saveOrderTemplate}
          onExit={context.closeOrderTemplateEditor}
        />
      );
    }
    return (
      <div className="panel">请从订单列表打开订单模板编辑器。</div>
    );
  }

  if (activeModule === 'exports') {
    return <ExportsPage exports={context.exports} />;
  }

  if (activeModule === 'account') {
    return (
      <AccountPage
        account={context.account}
        setAccount={context.setAccount}
        setStatus={context.setStatus}
      />
    );
  }

  if (activeModule === 'image-map-test') {
    return <ImageMapEditorTestPage shops={context.shops} initialProductId={context.selectedTemplateLibraryProductId} />;
  }

  if (activeModule === 'fonts') {
    return <FontsPage />;
  }

  if (activeModule === 'template-library') {
    return <TemplateLibraryPage
      products={context.products}
      shops={context.shops}
      selectedProductId={context.selectedTemplateLibraryProductId}
      selectedShopId={context.selectedTemplateLibraryShopId}
      onOpenTemplate={context.openTemplateLibraryTemplate}
      onCreateProduct={context.createProduct}
      onEditProduct={context.editProduct}
      onDeleteProduct={context.deleteProduct}
      onEditorModeChange={context.setTemplateLibraryEditorMode}
    />;
  }

  if (activeModule === 'inner-pages') {
    return <InnerPagesPage
      shops={context.shops}
      products={context.products}
      selectedShopId={context.selectedInnerPagesShopId}
      selectedProductId={context.selectedInnerPagesProductId}
      onEditorModeChange={context.setInnerPagesEditorMode}
    />;
  }

  if (activeModule === 'text-generation-rules') {
    return <TextGenerationRulesPage />;
  }

  if (activeModule === 'size-templates') {
    return (
      <SizeTemplatesPage
      shops={context.shops}
      selectedShopId={context.selectedSizeTemplatesShopId}
      selectedProductId={context.selectedTemplateLibraryProductId}
      initialTemplateId={context.selectedSizeTemplateId}
    />
    );
  }

  return (
    <ShopsPage
      shops={context.shops}
      loading={context.shopsLoading}
      loadError={context.shopsError}
      reloadShops={context.reloadShops}
      openShopOrders={context.openShopOrders}
      openShopSizeTemplates={context.openShopSizeTemplates}
    />
  );
}
