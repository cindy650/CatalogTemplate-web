import type { ReactNode } from 'react';
import type {
  AlbumTemplateDocument,
  ExportHistoryEntry,
  LocalUserProfile,
  Order,
  Shop,
  TemplateSummary
} from '@shared/domain';
import AccountPage from './account';
import EditorPage from './editor';
import ExportsPage from './exports';
import OrdersPage from './orders';
import ShopsPage from './shops';
import TemplatesPage from './templates';
import type { ModuleId } from './types';

type ModuleRenderContext = {
  account?: LocalUserProfile;
  currentDocument?: AlbumTemplateDocument;
  exports: ExportHistoryEntry[];
  loadError: string;
  loading: boolean;
  openOrderInEditor(order: Order): void;
  openTemplate(templateId: string): Promise<void>;
  orders: Order[];
  reloadOrders(): Promise<void>;
  reloadShops(): Promise<void>;
  selectedOrder?: Order;
  selectedOrderId: string;
  setAccount(account: LocalUserProfile): void;
  setCurrentDocument(document: AlbumTemplateDocument | undefined): void;
  setSelectedOrderId(orderId: string): void;
  setStatus(message: string): void;
  shops: Shop[];
  shopsError: string;
  shopsLoading: boolean;
  templates: TemplateSummary[];
};

export function renderActiveModule(activeModule: ModuleId, context: ModuleRenderContext): ReactNode {
  if (activeModule === 'orders') {
    return (
      <OrdersPage
        orders={context.orders}
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
    return (
      <EditorPage
        orders={context.orders}
        selectedOrderId={context.selectedOrderId}
        selectedOrder={context.selectedOrder}
        currentDocument={context.currentDocument}
        setCurrentDocument={context.setCurrentDocument}
        setSelectedOrderId={context.setSelectedOrderId}
        setStatus={context.setStatus}
      />
    );
  }

  if (activeModule === 'templates') {
    return (
      <TemplatesPage
        templates={context.templates}
        openTemplate={context.openTemplate}
        setStatus={context.setStatus}
      />
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

  return (
    <ShopsPage
      shops={context.shops}
      loading={context.shopsLoading}
      loadError={context.shopsError}
      reloadShops={context.reloadShops}
    />
  );
}
