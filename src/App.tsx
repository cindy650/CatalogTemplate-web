import { useCallback, useEffect, useRef, useState } from 'react';
import { App as AntdApp } from 'antd';
import type {
  ExportHistoryEntry,
  LocalUserProfile,
  Order,
  OrderListFilters,
  OrderStatusDefinition,
  ProductCategory,
  ProductCategoryPayload,
  CatalogSizeTemplate,
  Shop
} from '@shared/domain';
import AppLayout from './layout/AppLayout';
import { renderActiveModule } from './modules/moduleRenderer';
import { useAppRoute } from './router/useAppRoute';
import { connectOrderEventStream } from './services/orderEventStream';
import { notifyByVisibility, requestSystemNotificationPermission } from './services/notificationRouter';
import { playOrderNotificationSound } from './services/orderNotificationAudio';
import type { SseNotificationEvent } from '@shared/events';
import { browserAlbumApi } from './api';
import type { TemplateLibraryShopSelection } from './modules/moduleRegistry';
import { hasOrderTemplateJson } from './modules/orders/orderTemplate';

function App() {
  const { message, notification, modal } = AntdApp.useApp();
  const { activeModule, navigateToModule } = useAppRoute();
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<ProductCategory[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderStatuses, setOrderStatuses] = useState<OrderStatusDefinition[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderLimit, setOrderLimit] = useState(10);
  const [orderPage, setOrderPage] = useState(1);
  const [orderFilters, setOrderFilters] = useState<OrderListFilters>({ limit: 10, pages: 1 });
  const [exports, setExports] = useState<ExportHistoryEntry[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsError, setShopsError] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedSizeTemplatesShopId, setSelectedSizeTemplatesShopId] = useState<number>();
  const [selectedInnerPagesShopId, setSelectedInnerPagesShopId] = useState<number>();
  const [selectedInnerPagesProductId, setSelectedInnerPagesProductId] = useState<number>();
  const [selectedFontLayoutsShopId, setSelectedFontLayoutsShopId] = useState<number>();
  const [selectedFontLayoutsProductId, setSelectedFontLayoutsProductId] = useState<number>();
  const [selectedTemplateLibraryProductId, setSelectedTemplateLibraryProductId] = useState<number>();
  const [selectedTemplateLibraryShopId, setSelectedTemplateLibraryShopId] = useState<TemplateLibraryShopSelection>('ALL');
  const [selectedSizeTemplateId, setSelectedSizeTemplateId] = useState<number>();
  const [productEditor, setProductEditor] = useState<ProductCategory | null | undefined>(undefined);
  const [templateLibraryEditorMode, setTemplateLibraryEditorMode] = useState(false);
  const [innerPagesEditorMode, setInnerPagesEditorMode] = useState(false);
  const [orderTemplateEditorOrder, setOrderTemplateEditorOrder] = useState<Order>();
  const [account, setAccount] = useState<LocalUserProfile>();
  const [status, setStatus] = useState('准备就绪');
  const initializedRef = useRef(false);
  const orderFiltersRef = useRef<OrderListFilters>({ limit: 10, pages: 1 });

  useEffect(() => {
    void requestSystemNotificationPermission();
  }, []);

  const refreshOrders = useCallback(async (filters?: OrderListFilters) => {
    if (filters) {
      orderFiltersRef.current = filters;
      setOrderFilters(filters);
    }
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const result = await browserAlbumApi.orders.list(orderFiltersRef.current);
      const nextOrders = result.items;
      setOrders(nextOrders);
      setOrderTotal(result.total);
      setOrderLimit(result.limit);
      setOrderPage(result.pages);
      setSelectedOrderId((current) => (
        nextOrders.some((order) => order.id === current) ? current : nextOrders[0]?.id || ''
      ));
      setStatus(`已加载 ${nextOrders.length} 个订单，共 ${result.total} 个`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setOrdersError(errorMessage);
      setStatus(`订单加载失败：${errorMessage}`);
      message.error(`订单加载失败：${errorMessage}`);
    } finally {
      setOrdersLoading(false);
    }
  }, [message]);

  const refreshOrdersAfterSavedEvent = useCallback(async () => {
    try {
      const result = await browserAlbumApi.orders.list(orderFiltersRef.current);
      setOrders((current) => {
        const localById = new Map(current.map((order) => [order.id, order]));
        const mergedById = new Map<string, Order>();
        result.items.forEach((order) => {
          const existing = localById.get(order.id);
          mergedById.set(order.id, existing ? { ...existing, ...order } : order);
        });
        const nextOrders = Array.from(mergedById.values());
        current.forEach((order) => {
          if (!mergedById.has(order.id)) nextOrders.push(order);
        });
        return result.limit > 0 ? nextOrders.slice(0, result.limit) : nextOrders;
      });
      setOrderTotal(result.total);
      setOrderLimit(result.limit);
      setOrderPage(result.pages);
      setSelectedOrderId((current) => current || result.items[0]?.id || '');
      setOrdersError('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus(`新订单入库后刷新订单列表失败：${errorMessage}`);
      console.warn('[SSE] 新订单已入库，但订单列表刷新失败。', error);
    }
  }, []);

  const refreshOrderStatuses = useCallback(async () => {
    try {
      setOrderStatuses(await browserAlbumApi.orders.statuses());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      message.error(`订单状态加载失败：${errorMessage}`);
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

  const refreshProducts = useCallback(async () => {
    try {
      const nextProducts = await browserAlbumApi.products.list();
      setProducts(nextProducts);
      setSelectedTemplateLibraryProductId((current) => nextProducts.some((product) => product.id === current) ? current : nextProducts[0]?.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setProducts([]);
      setStatus(`产品分类加载失败：${errorMessage}`);
    }
  }, []);

  const refreshLocalData = useCallback(async () => {
    const [nextExports, nextAccount] = await Promise.all([
      browserAlbumApi.exports.list(),
      browserAlbumApi.user.get()
    ]);
    setExports(nextExports);
    setAccount(nextAccount);
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void refreshShops();
    void refreshProducts();
    void refreshOrders();
    void refreshOrderStatuses();
    void refreshLocalData().catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus(errorMessage);
      message.error(errorMessage);
    });
  }, [message, refreshLocalData, refreshOrders, refreshOrderStatuses, refreshProducts, refreshShops]);

  useEffect(() => {
    if (shops.length === 0) {
      setSelectedSizeTemplatesShopId(undefined);
      return;
    }
    setSelectedSizeTemplatesShopId((current) => (
      shops.some((shop) => shop.id === current) ? current : shops[0].id
    ));
  }, [shops]);

  useEffect(() => {
    const hasProductForShop = (shopId: number) => products.some((product) => (
      product.shopIds.includes(shopId) || product.shops.some((shop) => shop.id === shopId)
    ));
    const nextShopId = selectedInnerPagesShopId !== undefined && shops.some((shop) => shop.id === selectedInnerPagesShopId) && hasProductForShop(selectedInnerPagesShopId)
      ? selectedInnerPagesShopId
      : shops.find((shop) => hasProductForShop(shop.id))?.id;
    const availableProducts = products.filter((product) => nextShopId !== undefined && (
      product.shopIds.includes(nextShopId) || product.shops.some((shop) => shop.id === nextShopId)
    ));
    const nextProductId = availableProducts.some((product) => product.id === selectedInnerPagesProductId)
      ? selectedInnerPagesProductId
      : availableProducts[0]?.id;
    if (nextShopId !== selectedInnerPagesShopId) setSelectedInnerPagesShopId(nextShopId);
    if (nextProductId !== selectedInnerPagesProductId) setSelectedInnerPagesProductId(nextProductId);
  }, [products, selectedInnerPagesProductId, selectedInnerPagesShopId, shops]);

  useEffect(() => {
    const hasProductForShop = (shopId: number) => products.some((product) => (
      product.shopIds.includes(shopId) || product.shops.some((shop) => shop.id === shopId)
    ));
    const nextShopId = selectedFontLayoutsShopId !== undefined && shops.some((shop) => shop.id === selectedFontLayoutsShopId) && hasProductForShop(selectedFontLayoutsShopId)
      ? selectedFontLayoutsShopId
      : shops.find((shop) => hasProductForShop(shop.id))?.id;
    const availableProducts = products.filter((product) => nextShopId !== undefined && (
      product.shopIds.includes(nextShopId) || product.shops.some((shop) => shop.id === nextShopId)
    ));
    const nextProductId = availableProducts.some((product) => product.id === selectedFontLayoutsProductId)
      ? selectedFontLayoutsProductId
      : availableProducts[0]?.id;
    if (nextShopId !== selectedFontLayoutsShopId) setSelectedFontLayoutsShopId(nextShopId);
    if (nextProductId !== selectedFontLayoutsProductId) setSelectedFontLayoutsProductId(nextProductId);
  }, [products, selectedFontLayoutsProductId, selectedFontLayoutsShopId, shops]);

  useEffect(() => {
    return connectOrderEventStream({
      onOrderSaved: (event) => {
        const orderNumber = String(event.data.order.order_number ?? '').trim();
        const shop = String(event.data.order.shop ?? '').trim();
        const shopName = String(event.data.order.shop_name ?? '').trim();
        const description = [
          shop ? `店铺：${shop}` : '',
          shopName ? `店铺名称：${shopName}` : '',
          orderNumber ? `订单号：${orderNumber}` : ''
        ].filter(Boolean).join('；');

        playOrderNotificationSound();

        void notifyByVisibility({
          title: event.msg || '新订单已入库',
          body: description,
          tag: 'order.saved',
          inApp: () => {
            notification.info({
              message: event.msg || '新订单已入库',
              description,
              placement: 'topRight'
            });
          }
        });
        setStatus(description || event.msg || '新订单已入库');
        void refreshOrdersAfterSavedEvent();
      },
      onNotification: (event: SseNotificationEvent) => {
        const messageText = event.msg.trim();
        if (!messageText) return;
        if (event.type.startsWith('order.')) playOrderNotificationSound();
        void notifyByVisibility({
          title: messageText,
          body: '',
          tag: `sse.${event.type}`,
          inApp: () => {
            notification.info({
              message: messageText,
              placement: 'topRight'
            });
          }
        });
        setStatus(messageText);
      }
    });
  }, []);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? orders[0];

  function openOrderInEditor(order: Order) {
    if (!hasOrderTemplateJson(order)) {
      setStatus(`订单 ${order.orderNo} 尚未存储模板 JSON`);
      message.warning('该订单尚未存储模板 JSON，无法进入编辑页面');
      return;
    }
    setSelectedOrderId(order.id);
    setOrderTemplateEditorOrder(order);
    navigateToModule('editor');
    setStatus(`已打开订单 ${order.orderNo} 的订单模板快照`);
  }

  function closeOrderTemplateEditor() {
    setOrderTemplateEditorOrder(undefined);
    navigateToModule('orders');
    setStatus('已返回订单列表');
  }

  async function saveOrderTemplate(order: Order, templateJson: Record<string, unknown>) {
    await browserAlbumApi.orders.saveTemplateJson(order, templateJson);
    setOrders((current) => current.map((item) => (
      item.id === order.id ? { ...item, resolvedLayers: templateJson } : item
    )));
    setOrderTemplateEditorOrder((current) => (
      current?.id === order.id ? { ...current, resolvedLayers: templateJson } : current
    ));
    setStatus(`订单 ${order.orderNo} 的模板已保存`);
  }

  function openShopOrders(shop: Shop, status?: number) {
    const filters: OrderListFilters = {
      shop: shop.shop,
      status,
      limit: orderLimit,
      pages: 1
    };
    navigateToModule('orders');
    void refreshOrders(filters);
  }

  function openShopSizeTemplates(shop: Shop) {
    setSelectedSizeTemplatesShopId(shop.id);
    navigateToModule('size-templates');
  }

  function selectTemplateLibrary(productId: number, shopId: TemplateLibraryShopSelection) {
    setSelectedTemplateLibraryProductId(productId);
    setSelectedTemplateLibraryShopId(shopId);
  }

  function selectInnerPages(shopId: number, productId: number) {
    setSelectedInnerPagesShopId(shopId);
    setSelectedInnerPagesProductId(productId);
  }

  function selectFontLayouts(shopId: number, productId: number) {
    setSelectedFontLayoutsShopId(shopId);
    setSelectedFontLayoutsProductId(productId);
  }

  function clearTemplateLibraryContext() {
    setSelectedTemplateLibraryProductId(undefined);
    setSelectedTemplateLibraryShopId('ALL');
    setSelectedSizeTemplateId(undefined);
  }

  function openTemplateLibraryTemplate(template: CatalogSizeTemplate) {
    setSelectedTemplateLibraryProductId(template.productId ?? selectedTemplateLibraryProductId);
    setSelectedTemplateLibraryShopId(template.shopId);
    setSelectedSizeTemplatesShopId(template.shopId);
    setSelectedSizeTemplateId(template.id);
    navigateToModule('size-templates');
  }

  async function saveProduct(productId: number | undefined, payload: ProductCategoryPayload) {
    if (productId !== undefined) await browserAlbumApi.products.update(productId, payload);
    else await browserAlbumApi.products.create(payload);
    await refreshProducts();
    message.success(productId !== undefined ? '产品分类已更新' : '产品分类已创建');
  }

  function deleteProduct(product: ProductCategory) {
    modal.confirm({
      title: '删除产品分类',
      content: `确定删除“${product.name}”吗？关联模板不会被自动删除。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await browserAlbumApi.products.delete(product.id);
        await refreshProducts();
        message.success('产品分类已删除');
      }
    });
  }

  const moduleContent = renderActiveModule(activeModule, {
    account,
    exports,
    loadError: ordersError,
    loading: ordersLoading,
    openOrderInEditor,
    orderTemplateEditorOrder,
    saveOrderTemplate,
    closeOrderTemplateEditor,
    orders,
    orderLimit,
    orderPage,
    orderStatuses,
    orderFilters,
    orderTotal,
    openShopOrders,
    openShopSizeTemplates,
    reloadOrders: refreshOrders,
    reloadShops: refreshShops,
    selectedOrder,
    selectedOrderId,
    setAccount,
    setSelectedOrderId,
    setStatus,
    shops,
    shopsError,
    shopsLoading,
    selectedSizeTemplatesShopId,
    selectedInnerPagesShopId,
    selectedInnerPagesProductId,
    selectedFontLayoutsShopId,
    selectedFontLayoutsProductId,
    products,
    selectedTemplateLibraryProductId,
    selectedTemplateLibraryShopId,
    selectedSizeTemplateId,
    openTemplateLibraryTemplate,
    createProduct: () => setProductEditor(null),
    editProduct: (product) => setProductEditor(product),
    deleteProduct,
    setTemplateLibraryEditorMode,
    setInnerPagesEditorMode
  });

  return (
    <AppLayout
      activeModule={activeModule}
      account={account}
      editorMode={activeModule === 'editor' || activeModule === 'image-map-test' || activeModule === 'font-layouts' || (activeModule === 'template-library' && templateLibraryEditorMode) || (activeModule === 'inner-pages' && innerPagesEditorMode)}
      shops={shops}
      products={products}
      selectedSizeTemplatesShopId={selectedSizeTemplatesShopId}
      selectedTemplateLibraryProductId={selectedTemplateLibraryProductId}
      selectedTemplateLibraryShopId={selectedTemplateLibraryShopId}
      selectedInnerPagesShopId={selectedInnerPagesShopId}
      selectedInnerPagesProductId={selectedInnerPagesProductId}
      selectedFontLayoutsShopId={selectedFontLayoutsShopId}
      selectedFontLayoutsProductId={selectedFontLayoutsProductId}
      status={status}
      onModuleChange={navigateToModule}
      onSizeTemplatesShopChange={setSelectedSizeTemplatesShopId}
      onInnerPagesSelection={selectInnerPages}
      onFontLayoutsSelection={selectFontLayouts}
      onTemplateLibrarySelection={selectTemplateLibrary}
      onClearTemplateLibraryContext={clearTemplateLibraryContext}
      onSaveProduct={saveProduct}
      onDeleteProduct={async (product) => deleteProduct(product)}
      productEditor={productEditor}
      onOpenProductEditor={setProductEditor}
      onCloseProductEditor={() => setProductEditor(undefined)}
    >
      {moduleContent}
    </AppLayout>
  );
}

export default App;
