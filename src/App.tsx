import { useCallback, useEffect, useRef, useState } from 'react';
import { App as AntdApp } from 'antd';
import type {
  AlbumTemplateDocument,
  ExportHistoryEntry,
  LocalUserProfile,
  Order,
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [exports, setExports] = useState<ExportHistoryEntry[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
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
    void refreshOrders();
    void refreshLocalData().catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus(errorMessage);
      message.error(errorMessage);
    });
  }, [message, refreshLocalData, refreshOrders]);

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
    selectedOrder,
    selectedOrderId,
    setAccount,
    setCurrentDocument,
    setSelectedOrderId,
    setStatus,
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
