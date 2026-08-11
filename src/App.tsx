import { useCallback, useEffect, useRef, useState } from 'react';
import { App as AntdApp } from 'antd';
import type {
  AlbumTemplateDocument,
  ExportHistoryEntry,
  LocalUserProfile,
  Order,
  Shop,
  TemplateSummary
} from '@shared/domain';
import AppLayout from './layout/AppLayout';
import { renderActiveModule } from './modules/moduleRenderer';
import { useAppRoute } from './router/useAppRoute';
import { connectOrderEventStream } from './services/orderEventStream';
import { browserAlbumApi } from './api';

function App() {
  const { message, notification } = AntdApp.useApp();
  const { activeModule, navigateToModule } = useAppRoute();
  const [shops, setShops] = useState<Shop[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [exports, setExports] = useState<ExportHistoryEntry[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsError, setShopsError] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [currentDocument, setCurrentDocument] = useState<AlbumTemplateDocument>();
  const [account, setAccount] = useState<LocalUserProfile>();
  const [status, setStatus] = useState('准备就绪');
  const initializedRef = useRef(false);

  const refreshOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const nextOrders = await browserAlbumApi.orders.list();
      setOrders(nextOrders);
      setSelectedOrderId((current) => current || nextOrders[0]?.id || '');
      setStatus(`已加载 ${nextOrders.length} 个订单`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setOrdersError(errorMessage);
      setStatus(`订单加载失败：${errorMessage}`);
      message.error(`订单加载失败：${errorMessage}`);
    } finally {
      setOrdersLoading(false);
    }
  }, [message]);

  const refreshShops = useCallback(async () => {
    setShopsLoading(true);
    setShopsError('');
    try {
      const nextShops = await browserAlbumApi.shops.list();
      setShops(nextShops);
      setStatus(`已加载 ${nextShops.length} 个店铺`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setShopsError(errorMessage);
      setStatus(`店铺加载失败：${errorMessage}`);
      message.error(`店铺加载失败：${errorMessage}`);
    } finally {
      setShopsLoading(false);
    }
  }, [message]);

  const refreshLocalData = useCallback(async () => {
    const [nextTemplates, nextExports, nextAccount] = await Promise.all([
      browserAlbumApi.templates.list(),
      browserAlbumApi.exports.list(),
      browserAlbumApi.user.get()
    ]);
    setTemplates(nextTemplates);
    setExports(nextExports);
    setAccount(nextAccount);
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void refreshShops();
    void refreshOrders();
    void refreshLocalData().catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus(errorMessage);
      message.error(errorMessage);
    });
  }, [message, refreshLocalData, refreshOrders, refreshShops]);

  useEffect(() => {
    return connectOrderEventStream({
      onOrderSaved: (event) => {
        const orderNo = String(event.data.order.orderNo ?? event.data.order.order_no ?? event.data.order.id ?? '').trim();
        const description = orderNo
          ? '订单：' + orderNo + '；来源：' + event.data.source
          : '来源：' + event.data.source;

        notification.info({
          message: '收到新订单',
          description,
          placement: 'topRight'
        });
        setStatus(orderNo ? '收到新订单提醒：' + orderNo : '收到新订单提醒');
      }
    });
  }, [notification]);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? orders[0];

  async function openTemplate(templateId: string) {
    try {
      const document = await browserAlbumApi.templates.getLatest(templateId);
      if (!document) {
        setStatus('未找到模板');
        message.warning('未找到模板');
        return;
      }
      setCurrentDocument(document);
      navigateToModule('editor');
      setStatus(`已打开模板：${document.name}`);
      message.success(`已打开模板：${document.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus(`打开模板失败：${errorMessage}`);
      message.error(`打开模板失败：${errorMessage}`);
    }
  }

  function openOrderInEditor(order: Order) {
    setSelectedOrderId(order.id);
    setCurrentDocument(undefined);
    navigateToModule('editor');
    setStatus(`已选择订单 ${order.orderNo}，进入模板编辑器`);
    message.success(`已载入订单 ${order.orderNo}`);
  }

  const moduleContent = renderActiveModule(activeModule, {
    account,
    currentDocument,
    exports,
    loadError: ordersError,
    loading: ordersLoading,
    openOrderInEditor,
    openTemplate,
    orders,
    reloadOrders: refreshOrders,
    reloadShops: refreshShops,
    selectedOrder,
    selectedOrderId,
    setAccount,
    setCurrentDocument,
    setSelectedOrderId,
    setStatus,
    shops,
    shopsError,
    shopsLoading,
    templates
  });

  return (
    <AppLayout
      activeModule={activeModule}
      editorMode={activeModule === 'editor'}
      status={status}
      onModuleChange={navigateToModule}
    >
      {moduleContent}
    </AppLayout>
  );
}

export default App;
