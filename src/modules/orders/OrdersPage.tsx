import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { App, Alert, Button, Card, Descriptions, Empty, Input, Modal, Pagination, Popconfirm, Result, Select, Space, Spin, Steps, Table, Tag, Tooltip } from 'antd';
import { AppstoreOutlined, CheckOutlined, EditOutlined, FileTextOutlined, PrinterOutlined, ReloadOutlined, SearchOutlined, SendOutlined, ShopOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { CatalogSizeTemplate, Order, OrderItem, OrderListFilters, ProductCategory } from '@shared/domain';
import { browserAlbumApi } from '../../api';
import type { OrdersPageProps } from '../types';
import { downloadExportFile } from './downloadExport';
import { hasOrderTemplateJson } from './orderTemplate';

type OrderTableRow = {
  order: Order;
  item: OrderItem;
};

const productInformationColumnWidth = 420;

const orderStatusColors: Record<number, string> = {
  0: 'blue',
  1: 'gold',
  2: 'cyan',
  3: 'purple',
  4: 'orange',
  5: 'green'
};

type OrderFixedColumnSizing = {
  status: number;
  actions: number;
};

function fixedColumnSizing(viewportWidth: number): OrderFixedColumnSizing {
  if (viewportWidth < 600) return { status: 68, actions: 94 };
  if (viewportWidth < 900) return { status: 92, actions: 108 };
  if (viewportWidth < 1280) return { status: 120, actions: 128 };
  return { status: 144, actions: 150 };
}
function useOrderFixedColumnSizing(): OrderFixedColumnSizing {
  const [sizing, setSizing] = useState<OrderFixedColumnSizing>(() => (
    fixedColumnSizing(typeof window === 'undefined' ? 1280 : window.innerWidth)
  ));

  useEffect(() => {
    const updateSizing = () => setSizing(fixedColumnSizing(window.innerWidth));
    window.addEventListener('resize', updateSizing);
    return () => window.removeEventListener('resize', updateSizing);
  }, []);

  return sizing;
}
function useOrderTableBodyHeight(measureKey: unknown) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState(240);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const updateHeight = () => {
      const tableHeader = card.querySelector<HTMLElement>('.ant-table-thead');
      const footer = card.querySelector<HTMLElement>('.orders-footer');
      if (!tableHeader || !footer) return;

      const cardStyles = window.getComputedStyle(card);
      const verticalBorders = Number.parseFloat(cardStyles.borderTopWidth)
        + Number.parseFloat(cardStyles.borderBottomWidth);
      const availableHeight = Math.floor(
        card.clientHeight - footer.offsetHeight - tableHeader.offsetHeight - verticalBorders
      );
      setBodyHeight((current) => current === availableHeight ? current : Math.max(120, availableHeight));
    };

    const observer = new ResizeObserver(updateHeight);
    observer.observe(card);
    const tableHeader = card.querySelector<HTMLElement>('.ant-table-thead');
    const footer = card.querySelector<HTMLElement>('.orders-footer');
    if (tableHeader) observer.observe(tableHeader);
    if (footer) observer.observe(footer);
    window.addEventListener('resize', updateHeight);
    updateHeight();

    return () => {
      window.removeEventListener('resize', updateHeight);
      observer.disconnect();
    };
  }, [measureKey]);

  return { cardRef, bodyHeight };
}

function orderActionIcon(status: Order['status']) {
  return status === 4 ? <SendOutlined /> : <CheckOutlined />;
}

const fallbackOrderActionText: Record<number, string> = {
  0: '发送示意图',
  1: '客户已确认',
  2: '确认生产',
  3: '完成生产',
  4: '已发货'
};

function orderActionText(order: Order): string {
  return order.statusButtonText || fallbackOrderActionText[order.status] || '';
}

function statusTextLines(statusText: string) {
  const lines = statusText.split('/').map((line) => line.trim()).filter(Boolean);
  return (lines.length > 0 ? lines : [statusText]).map((line, index) => (
    <span key={`${line}:${index}`}>{line}</span>
  ));
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-/]+/g, '');
}

function readRawValue(raw: Record<string, string>, candidates: readonly string[]): string {
  for (const candidate of candidates) {
    const value = raw[normalizeHeader(candidate)] ?? raw[candidate];
    if (value) return value;
  }
  return '';
}

function orderRows(orders: Order[]): OrderTableRow[] {
  return orders.flatMap((order) =>
    order.items.length > 0
      ? order.items.map((item) => ({ order, item }))
      : [{
        order,
        item: {
          id: `${order.id}:empty`,
          orderId: order.id,
          sku: '',
          productName: '',
          customInfo: '',
          quantity: 0,
          raw: order.raw
        }
      }]
  );
}

function textMarkedFields(orders: Order[]): string[] {
  const fields = new Set<string>();

  for (const order of orders) {
    for (const field of Object.keys(order.fieldLabels)) {
      if (field !== 'product_information') fields.add(field);
    }
  }

  const orderedFields = [...fields];
  const shopIndex = orderedFields.indexOf('shop');
  const shopNameIndex = orderedFields.indexOf('shop_name');
  if (shopIndex >= 0 && shopNameIndex >= 0 && shopNameIndex !== shopIndex + 1) {
    orderedFields.splice(shopNameIndex, 1);
    orderedFields.splice(orderedFields.indexOf('shop') + 1, 0, 'shop_name');
  }

  return orderedFields;
}

function orderFieldTitle(orders: Order[], fieldKey: string, fallbackTitle: string): string {
  for (const order of orders) {
    const label = order.fieldLabels[fieldKey];
    if (label) return label;
  }

  return fallbackTitle;
}

function orderFieldWidth(field: string): number {
  if (field.includes('address')) return 320;
  if (field === 'product') return 240;
  if (field === 'payment_method') return 220;
  return 160;
}

function formatCreatedAt(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export default function OrdersPage({
  orders,
  orderTotal,
  orderLimit,
  orderPage,
  orderStatuses,
  shops,
  filters,
  selectedOrderId,
  loading,
  loadError,
  reloadOrders,
  setSelectedOrderId,
  openOrderInEditor
}: OrdersPageProps) {
  const { message } = App.useApp();
  const [exportingOrderId, setExportingOrderId] = useState('');
  const [advancingOrderId, setAdvancingOrderId] = useState('');
  const [sendingPreviewOrderId, setSendingPreviewOrderId] = useState('');
  const exportingOrderRef = useRef('');
  const advancingOrderRef = useRef('');
  const sendingPreviewOrderRef = useRef('');
  const [editingSetupOrder, setEditingSetupOrder] = useState<Order>();
  const [editingSetupStep, setEditingSetupStep] = useState(1);
  const [setupProducts, setSetupProducts] = useState<ProductCategory[]>([]);
  const [setupProductsLoading, setSetupProductsLoading] = useState(false);
  const [setupProductId, setSetupProductId] = useState<number>();
  const [setupTemplates, setSetupTemplates] = useState<CatalogSizeTemplate[]>([]);
  const [setupTemplatesLoading, setSetupTemplatesLoading] = useState(false);
  const [setupTemplateId, setSetupTemplateId] = useState<number>();
  const [setupOptionId, setSetupOptionId] = useState<string>();
  const [setupError, setSetupError] = useState('');
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState(filters.orderNumber ?? '');
  const [shop, setShop] = useState<string | undefined>(filters.shop);
  const [status, setStatus] = useState<number | undefined>(filters.status);
  const fixedColumns = useOrderFixedColumnSizing();
  const { cardRef: tableCardRef, bodyHeight: tableBodyHeight } = useOrderTableBodyHeight(orders);
  const rows = orderRows(orders);
  const textFields = textMarkedFields(orders);

  const setupShopId = editingSetupOrder?.shopId;
  const setupShop = setupShopId === undefined ? undefined : shops.find((item) => item.id === setupShopId);
  const selectedSetupTemplate = setupTemplates.find((item) => item.id === setupTemplateId);
  const selectedSetupOption = selectedSetupTemplate?.sizeOptions.find((item) => item.id === setupOptionId);
  const orderActionBusy = Boolean(exportingOrderId || advancingOrderId || sendingPreviewOrderId);

  useEffect(() => {
    if (!editingSetupOrder) return;
    setSetupProducts([]);
    setSetupProductId(undefined);
    setSetupTemplates([]);
    setSetupTemplateId(undefined);
    setSetupOptionId(undefined);
    setSetupError('');
    setEditingSetupStep(1);
    if (setupShopId === undefined) {
      setSetupError('订单缺少 shop_id，无法查询当前店铺的产品。');
      return;
    }
    let cancelled = false;
    setSetupProductsLoading(true);
    void browserAlbumApi.products.list({ shopId: setupShopId, limit: 100, offset: 0 })
      .then((items) => {
        if (!cancelled) setSetupProducts(items);
      })
      .catch((error) => {
        if (!cancelled) setSetupError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setSetupProductsLoading(false);
      });
    return () => { cancelled = true; };
  }, [editingSetupOrder, setupShopId]);

  useEffect(() => {
    if (!editingSetupOrder || setupShopId === undefined || setupProductId === undefined) {
      setSetupTemplates([]);
      setSetupTemplateId(undefined);
      setSetupOptionId(undefined);
      return;
    }
    let cancelled = false;
    setSetupTemplatesLoading(true);
    setSetupError('');
    void browserAlbumApi.catalogSizeTemplates.list({ shopId: setupShopId, productId: setupProductId, limit: 100, offset: 0 })
      .then((items) => {
        if (!cancelled) setSetupTemplates(items);
      })
      .catch((error) => {
        if (!cancelled) {
          setSetupTemplates([]);
          setSetupError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!cancelled) setSetupTemplatesLoading(false);
      });
    return () => { cancelled = true; };
  }, [editingSetupOrder, setupProductId, setupShopId]);

  useEffect(() => {
    setOrderNumber(filters.orderNumber ?? '');
    setShop(filters.shop);
    setStatus(filters.status);
  }, [filters.orderNumber, filters.shop, filters.status]);
  const productInformationColumn: ColumnsType<OrderTableRow> = [{
    title: '商品信息',
    key: 'product-information',
    width: productInformationColumnWidth,
    render: (_: unknown, { order }: OrderTableRow) => {
      const entries = Object.entries(order.productInformation).filter(([, value]) => value.trim());
      if (entries.length === 0) return <span className="order-cell-content">-</span>;

      return (
        <div className="order-product-information">
          {entries.map(([field, value]) => (
            <div key={field} className="order-product-information-item">
              <span className="order-product-information-label">
                {order.productInformationLabels[field] || field}：
              </span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      );
    }
  }];
  const textMarkedColumns: ColumnsType<OrderTableRow> = textFields.map((field) => {
    return {
      title: orderFieldTitle(orders, field, field),
      key: `text-marked:${field}`,
      width: orderFieldWidth(field),
      render: (_: unknown, { item }: OrderTableRow) => (
        <span className="order-cell-content">{readRawValue(item.raw, [field]) || '-'}</span>
      )
    };
  });
  const productColumnIndex = textFields.indexOf('product');
  const orderedDataColumns: ColumnsType<OrderTableRow> = productColumnIndex >= 0
    ? [
      ...textMarkedColumns.slice(0, productColumnIndex + 1),
      ...productInformationColumn,
      ...textMarkedColumns.slice(productColumnIndex + 1)
    ]
    : [
      ...textMarkedColumns,
      ...productInformationColumn
    ];
  const createdAtColumn: ColumnsType<OrderTableRow> = [{
    title: '创建时间',
    key: 'created-at',
    width: 178,
    render: (_: unknown, { order }: OrderTableRow) => (
      <span className="order-cell-content">{formatCreatedAt(order.createdAt)}</span>
    )
  }];

  async function confirmProduction(order: Order): Promise<void> {
    if (exportingOrderRef.current || orderActionBusy) return;
    exportingOrderRef.current = order.id;
    setExportingOrderId(order.id);
    let downloadStarted = false;
    try {
      const file = await browserAlbumApi.orders.exportTemplate(order);
      downloadExportFile(file);
      downloadStarted = true;
      await browserAlbumApi.orders.advanceStatus(order);
      await reloadOrders();
      message.success(`订单 ${order.orderNo} 的生成文件 ZIP 已开始下载，订单状态已更新`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      message.error(downloadStarted
        ? `订单 ${order.orderNo} 的 ZIP 已开始下载，但状态更新失败：${errorMessage}`
        : `订单 ${order.orderNo} 确认生产失败：${errorMessage}`);
    } finally {
      if (exportingOrderRef.current === order.id) {
        exportingOrderRef.current = '';
        setExportingOrderId('');
      }
    }
  }

  async function downloadProductionFile(order: Order): Promise<void> {
    if (exportingOrderRef.current || orderActionBusy) return;
    exportingOrderRef.current = order.id;
    setExportingOrderId(order.id);
    try {
      const file = await browserAlbumApi.orders.exportTemplate(order);
      downloadExportFile(file);
      message.success(`订单 ${order.orderNo} 的生产文件 ZIP 已开始下载`);
    } catch (error) {
      message.error(`订单 ${order.orderNo} 下载生产文件失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (exportingOrderRef.current === order.id) {
        exportingOrderRef.current = '';
        setExportingOrderId('');
      }
    }
  }

  async function sendPreviewImages(order: Order): Promise<void> {
    if (sendingPreviewOrderRef.current || orderActionBusy) return;
    sendingPreviewOrderRef.current = order.id;
    setSendingPreviewOrderId(order.id);
    try {
      await browserAlbumApi.orders.sendPreviewImages(order);
      await reloadOrders();
      message.success(`订单 ${order.orderNo} 的示意图已发送`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      message.error(`订单 ${order.orderNo} 发送示意图失败：${errorMessage}`);
    } finally {
      if (sendingPreviewOrderRef.current === order.id) {
        sendingPreviewOrderRef.current = '';
        setSendingPreviewOrderId('');
      }
    }
  }

  async function advanceOrderStatus(order: Order): Promise<void> {
    const actionText = orderActionText(order);
    if (!actionText) return;

    if (advancingOrderRef.current || orderActionBusy) return;
    advancingOrderRef.current = order.id;
    setAdvancingOrderId(order.id);
    try {
      await browserAlbumApi.orders.advanceStatus(order);
      await reloadOrders();
      message.success(`订单 ${order.orderNo} 已完成“${actionText}”操作`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      message.error(`订单 ${order.orderNo} 状态更新失败：${errorMessage}`);
    } finally {
      if (advancingOrderRef.current === order.id) {
        advancingOrderRef.current = '';
        setAdvancingOrderId('');
      }
    }
  }

  function searchOrders(): void {
    const filters: OrderListFilters = {
      orderNumber: orderNumber.trim() || undefined,
      shop,
      status,
      limit: orderLimit,
      pages: 1
    };
    void reloadOrders(filters);
  }

  function resetSearch(): void {
    setOrderNumber('');
    setShop(undefined);
    setStatus(undefined);
    void reloadOrders({ limit: orderLimit, pages: 1 });
  }

  function openEditSetup(order: Order): void {
    if (hasOrderTemplateJson(order)) {
      openOrderInEditor(order);
      return;
    }
    setEditingSetupOrder(order);
  }

  async function completeEditSetup(): Promise<void> {
    if (!editingSetupOrder || !setupProductId || !setupTemplateId || !setupOptionId) return;
    setSetupSubmitting(true);
    setSetupError('');
    try {
      const associatedOrder = await browserAlbumApi.orders.associateTemplate(editingSetupOrder, {
        productId: setupProductId,
        sizeTemplateId: setupTemplateId,
        sizeOptionId: setupOptionId
      });
      await reloadOrders();
      message.success(`订单 ${editingSetupOrder.orderNo} 的产品、尺寸模板和规格关联成功`);
      setEditingSetupOrder(undefined);
      if (hasOrderTemplateJson(associatedOrder)) openOrderInEditor(associatedOrder);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setSetupError(errorMessage);
      message.error(`订单 ${editingSetupOrder.orderNo} 模板关联失败：${errorMessage}`);
    } finally {
      setSetupSubmitting(false);
    }
  }

  const columns: ColumnsType<OrderTableRow> = [
      ...orderedDataColumns,
      ...createdAtColumn,
    {
      title: '状态',
      key: 'status',
      width: fixedColumns.status,
      fixed: 'right',
      align: 'center',
      className: 'order-status-column',
      render: (_: unknown, { order }: OrderTableRow) => (
        <Tag
          className={`order-status-tag order-status-tag-${order.status}`}
          color={orderStatusColors[order.status] ?? 'default'}
        >
          <span className="order-status-text">{statusTextLines(order.statusText)}</span>
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: fixedColumns.actions,
      fixed: 'right',
      align: 'center',
      className: 'order-actions-column',
      render: (_: unknown, { order }: OrderTableRow) => (
        <Space className="order-actions" orientation="vertical" size={2}>
          {order.status === 0 && (
            <Button
              block
              size="small"
              icon={<EditOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                openEditSetup(order);
              }}
            >
              开始编辑
            </Button>
          )}
          {order.status === 0 && (
            <Button
              block
              size="small"
              type="primary"
              icon={<SendOutlined />}
              loading={sendingPreviewOrderId === order.id}
              disabled={orderActionBusy}
              onClick={(event) => {
                event.stopPropagation();
                void sendPreviewImages(order);
              }}
            >
              {orderActionText(order)}
            </Button>
          )}
          {order.status === 1 && (
            <Tooltip title={hasOrderTemplateJson(order) ? undefined : '该订单尚未存储模板 JSON'}>
              <span style={{ display: 'block', width: '100%' }}>
                <Button
                  block
                  size="small"
                  icon={<EditOutlined />}
                  disabled={!hasOrderTemplateJson(order)}
                  onClick={(event) => {
                    event.stopPropagation();
                    openOrderInEditor(order);
                  }}
                >
                  编辑订单
                </Button>
              </span>
            </Tooltip>
          )}
          {order.status === 1 && (
            <Popconfirm
              title={`确认“${orderActionText(order)}”？`}
              description="确认后将推进订单状态，操作完成后会刷新订单列表。"
              okText="确认"
              cancelText="取消"
              onConfirm={(event) => {
                event?.stopPropagation();
                void advanceOrderStatus(order);
              }}
              onCancel={(event) => event?.stopPropagation()}
            >
              <Button
                block
                size="small"
                type="primary"
                icon={orderActionIcon(order.status)}
                loading={advancingOrderId === order.id}
                disabled={orderActionBusy}
                onClick={(event) => event.stopPropagation()}
              >
                {orderActionText(order)}
              </Button>
            </Popconfirm>
          )}
          {order.status === 2 && (
            <Popconfirm
              title="下载生成文件zip"
              description="确认下载该订单的生成文件 ZIP？"
              okText="下载"
              cancelText="取消"
              onConfirm={(event) => {
                event?.stopPropagation();
                void confirmProduction(order);
              }}
              onCancel={(event) => event?.stopPropagation()}
            >
              <Button
                block
                size="small"
                type="primary"
                icon={<PrinterOutlined />}
                loading={exportingOrderId === order.id}
                disabled={orderActionBusy}
                onClick={(event) => event.stopPropagation()}
              >
                {orderActionText(order)}
              </Button>
            </Popconfirm>
          )}
          {order.status >= 3 && order.status <= 4 && orderActionText(order) && (
            <Popconfirm
              title={`确认“${orderActionText(order)}”？`}
              description="确认后将推进订单状态，操作完成后会刷新订单列表。"
              okText="确认"
              cancelText="取消"
              onConfirm={(event) => {
                event?.stopPropagation();
                void advanceOrderStatus(order);
              }}
              onCancel={(event) => event?.stopPropagation()}
            >
              <Button
                block
                size="small"
                type="primary"
                icon={orderActionIcon(order.status)}
                loading={advancingOrderId === order.id}
                disabled={orderActionBusy}
                onClick={(event) => event.stopPropagation()}
              >
                {orderActionText(order)}
              </Button>
            </Popconfirm>
          )}
          {order.status >= 3 && (
            <Popconfirm
              title="下载生产文件"
              description="确认下载该订单的生产文件 ZIP？"
              okText="下载"
              cancelText="取消"
              onConfirm={(event) => {
                event?.stopPropagation();
                void downloadProductionFile(order);
              }}
              onCancel={(event) => event?.stopPropagation()}
            >
              <Button
                block
                size="small"
                type="primary"
                icon={<PrinterOutlined />}
                loading={exportingOrderId === order.id}
                disabled={orderActionBusy}
                onClick={(event) => event.stopPropagation()}
              >
                下载生产文件
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const editSetupModal = editingSetupOrder ? (
    <Modal
      open
      title="开始编辑订单"
      width="min(780px, calc(100vw - 24px))"
      destroyOnHidden
      onCancel={() => {
        if (!setupSubmitting) setEditingSetupOrder(undefined);
      }}
      footer={(
        <Space>
          <Button disabled={setupSubmitting} onClick={() => setEditingSetupOrder(undefined)}>取消</Button>
          <Button
            type="primary"
            loading={setupSubmitting}
            disabled={setupSubmitting || !setupProductId || !setupTemplateId || !setupOptionId}
            onClick={() => void completeEditSetup()}
          >
            保存关联并进入编辑器
          </Button>
        </Space>
      )}
    >
      <div className="order-edit-setup-modal">
        <div className="order-edit-setup-summary-grid">
          <Card className="order-edit-setup-summary" size="small" title="订单数据">
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="订单号">{editingSetupOrder.orderNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="店铺">{editingSetupOrder.raw.shop || '-'}</Descriptions.Item>
              <Descriptions.Item label="店铺名">{editingSetupOrder.raw.shop_name || setupShop?.shopName || '-'}</Descriptions.Item>
              <Descriptions.Item label="当前状态">{editingSetupOrder.statusText || '新订单'}</Descriptions.Item>
              <Descriptions.Item label="商品">{editingSetupOrder.raw.product || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card className="order-edit-setup-summary order-edit-setup-product-information" size="small" title="商品信息">
            {Object.entries(editingSetupOrder.productInformation).filter(([, value]) => value.trim()).length ? (
              <Descriptions size="small" column={1}>
                {Object.entries(editingSetupOrder.productInformation)
                  .filter(([, value]) => value.trim())
                  .map(([field, value]) => (
                    <Descriptions.Item
                      key={`product-information:${field}`}
                      label={editingSetupOrder.productInformationLabels[field] || field}
                    >
                      {value}
                    </Descriptions.Item>
                  ))}
              </Descriptions>
            ) : <span className="order-edit-setup-empty-information">暂无商品信息</span>}
          </Card>
        </div>

        <Steps
          className="order-edit-setup-steps"
          responsive
          current={editingSetupStep}
          items={[
            { title: '确认店铺', description: setupShop?.shopName || setupShop?.shop || editingSetupOrder.raw.shop || '缺少店铺', icon: <ShopOutlined /> },
            { title: '选择产品', description: setupProductId ? '已选择' : '从当前店铺加载', icon: <AppstoreOutlined /> },
            { title: '选择尺寸模板', description: setupTemplateId ? '已选择' : '选择模板', icon: <FileTextOutlined /> },
            { title: '选择规格', description: setupOptionId ? '已选择' : '选择尺寸方案', icon: <CheckOutlined /> }
          ]}
        />

        {setupError ? <Alert type="error" showIcon message="操作失败" description={setupError} /> : null}

        <div className="order-edit-setup-step-content">
          {editingSetupStep === 1 ? (
            <Card size="small" title="选择当前店铺的产品">
              {setupProductsLoading ? <div className="order-edit-setup-loading"><Spin tip="正在查询产品..." /></div> : (
                <Select
                  className="order-edit-setup-select"
                  showSearch
                  optionFilterProp="label"
                  placeholder={setupShop || editingSetupOrder.raw.shop ? `请选择 ${setupShop?.shopName || setupShop?.shop || editingSetupOrder.raw.shop} 下的产品` : '无法确定店铺'}
                  value={setupProductId}
                  options={setupProducts.map((product) => ({ value: product.id, label: product.name }))}
                  onChange={(value) => {
                    setSetupProductId(value);
                    setSetupTemplateId(undefined);
                    setSetupOptionId(undefined);
                    setEditingSetupStep(2);
                  }}
                  disabled={setupShopId === undefined || setupProductsLoading}
                />
              )}
            </Card>
          ) : null}

          {editingSetupStep === 2 ? (
            <Card size="small" title="选择产品下的尺寸模板">
              {setupTemplatesLoading ? <div className="order-edit-setup-loading"><Spin tip="正在查询尺寸模板..." /></div> : (
                <Select
                  className="order-edit-setup-select"
                  showSearch
                  optionFilterProp="label"
                  placeholder="请选择尺寸模板"
                  value={setupTemplateId}
                  options={setupTemplates.map((template) => ({ value: template.id, label: template.name || `尺寸模板 ${template.id}` }))}
                  onChange={(value) => {
                    setSetupTemplateId(value);
                    setSetupOptionId(undefined);
                    setEditingSetupStep(3);
                  }}
                  disabled={setupTemplatesLoading || setupProducts.length === 0}
                />
              )}
              {!setupTemplatesLoading && setupTemplates.length === 0 ? (
                <Alert className="order-edit-setup-inline-alert" type="warning" showIcon message="当前产品没有可用的尺寸模板" />
              ) : null}
            </Card>
          ) : null}

          {editingSetupStep === 3 ? (
            <Card size="small" title="选择模板中的规格">
              <Select
                className="order-edit-setup-select"
                showSearch
                optionFilterProp="label"
                placeholder="请选择规格尺寸"
                value={setupOptionId}
                options={selectedSetupTemplate?.sizeOptions.map((option) => ({ value: option.id, label: option.label || option.id })) ?? []}
                onChange={(value) => {
                  setSetupOptionId(value);
                  setEditingSetupStep(4);
                }}
                disabled={!selectedSetupTemplate}
              />
              {!selectedSetupTemplate?.sizeOptions.length ? (
                <Alert className="order-edit-setup-inline-alert" type="warning" showIcon message="该尺寸模板没有可选规格" />
              ) : null}
            </Card>
          ) : null}

          {editingSetupStep === 4 ? (
            <Card size="small" title="确认编辑配置">
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="店铺">{setupShop?.shopName || setupShop?.shop || '-'}</Descriptions.Item>
                <Descriptions.Item label="产品">{setupProducts.find((item) => item.id === setupProductId)?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="尺寸模板">{selectedSetupTemplate?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="规格">{selectedSetupOption?.label || selectedSetupOption?.id || '-'}</Descriptions.Item>
              </Descriptions>
              <Alert
                className="order-edit-setup-inline-alert"
                type="info"
                showIcon
                message="确认模板关联"
                description="确认后将调用模板关联接口，由后端校验店铺、产品、尺寸模板和规格，并一次事务保存订单。"
              />
            </Card>
          ) : null}
        </div>

        <div className="order-edit-setup-navigation">
          <Button disabled={editingSetupStep <= 1} onClick={() => setEditingSetupStep((step) => Math.max(1, step - 1))}>上一步</Button>
          <Button
            type="link"
            disabled={editingSetupStep >= 4 || (editingSetupStep === 1 && !setupProductId) || (editingSetupStep === 2 && !setupTemplateId) || (editingSetupStep === 3 && !setupOptionId)}
            onClick={() => setEditingSetupStep((step) => Math.min(4, step + 1))}
          >
            下一步
          </Button>
        </div>
      </div>
    </Modal>
  ) : null;

  return (
    <>
      <section className="panel orders-panel">
      <header className="panel-header">
        <div className="orders-heading">
          <h1>订单管理</h1>
          <p>单击订单行选中订单，双击行进入模板编辑器。</p>
        </div>
        <div className="order-search-bar">
          <Input
            allowClear
            className="order-search-number"
            placeholder="订单号"
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
            onPressEnter={searchOrders}
          />
          <Select
            allowClear
            showSearch
            className="order-search-select"
            placeholder="店铺"
            optionFilterProp="label"
            value={shop}
            options={shops.map((item) => ({
              value: item.shop,
              label: item.shopName ? `${item.shopName} (${item.shop})` : item.shop
            }))}
            onChange={setShop}
          />
          <Select
            allowClear
            className="order-search-select order-status-select"
            placeholder="状态"
            value={status}
            options={orderStatuses.map((item) => ({
              value: item.status,
              label: item.statusText
            }))}
            onChange={setStatus}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={searchOrders}>
            查询
          </Button>
          <Button disabled={loading} onClick={resetSearch}>重置</Button>
          <Tooltip title="刷新当前查询结果">
            <Button
              aria-label="刷新当前查询结果"
              icon={<ReloadOutlined spin={loading} />}
              disabled={loading}
              onClick={() => void reloadOrders()}
            />
          </Tooltip>
        </div>
      </header>

      <div ref={tableCardRef} className="table-card order-table-card">
        <Table<OrderTableRow>
          className="orders-table"
          columns={columns}
          dataSource={rows}
          bordered
          rowKey={({ order, item }) => `${order.id}:${item.id}`}
          loading={{ spinning: loading, description: '正在加载订单...' }}
          pagination={false}
          scroll={{
            x: fixedColumns.status + fixedColumns.actions + productInformationColumnWidth + textFields.reduce(
              (width, field) => width + orderFieldWidth(field),
              0
            ),
            y: tableBodyHeight
          }}
          rowClassName={({ order }) => [
            `order-status-row-${order.status}`,
            selectedOrderId === order.id ? 'selected' : ''
          ].filter(Boolean).join(' ')}
          onRow={({ order }) => ({
            onClick: () => setSelectedOrderId(order.id),
            onDoubleClick: () => {
              if (order.status < 2 && hasOrderTemplateJson(order)) openOrderInEditor(order);
              else message.warning('该订单尚未存储模板 JSON，无法进入编辑页面');
            }
          })}
          locale={{
            emptyText: loadError ? (
              <Result
                status="error"
                title="订单加载失败"
                subTitle={loadError}
                extra={<Button type="primary" icon={<ReloadOutlined />} onClick={() => void reloadOrders()}>重新加载</Button>}
              />
            ) : (
              <Empty description="暂无订单数据">
                <Button icon={<ReloadOutlined />} onClick={() => void reloadOrders()}>刷新列表</Button>
              </Empty>
            )
          }}
        />
        <footer className="orders-footer">
          <Pagination
            showQuickJumper
            showSizeChanger
            current={orderPage}
            pageSize={orderLimit}
            total={orderTotal}
            pageSizeOptions={[10, 20, 50, 100]}
            showTotal={(total) => `共 ${total} 条`}
            onChange={(page, pageSize) => void reloadOrders({
              orderNumber: orderNumber.trim() || undefined,
              shop,
              status,
              limit: pageSize,
              pages: page
            })}
          />
        </footer>
      </div>
      </section>
      {editSetupModal}
    </>
  );
}
