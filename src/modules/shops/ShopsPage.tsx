import { useEffect, useState, type CSSProperties, type ComponentProps, type PointerEvent, type ReactNode } from 'react';
import {
  AppstoreOutlined,
  ColumnWidthOutlined,
  DeleteOutlined,
  EditOutlined,
  FontSizeOutlined,
  MinusOutlined,
  PlusOutlined,
  ReloadOutlined,
  ShoppingCartOutlined
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Result,
  Skeleton,
  Space,
  Statistic,
  Select,
  Tag,
  Tooltip
} from 'antd';
import type { Shop, ShopPayload } from '@shared/domain';
import { browserAlbumApi } from '../../api';
import type { ShopsPageProps } from '../types';

type ShopFormValues = {
  shop: string;
  shopName: string;
  settlementCurrency: string;
  wecomRobotWebhookUrl?: string;
};

type ShopModalMode = 'create' | 'edit' | 'view';

const shopOrderStatuses = [
  { status: 0, label: '新订单', countKey: 'newOrderCount', className: 'new' },
  { status: 1, label: '客户确认中', countKey: 'confirmationCount', className: 'confirmation' },
  { status: 2, label: '待生产', countKey: 'pendingProductionCount', className: 'pending-production' },
  { status: 3, label: '生产中', countKey: 'inProductionCount', className: 'production' },
  { status: 4, label: '待发货', countKey: 'pendingShipmentCount', className: 'shipment' },
  { status: 5, label: '已完成', countKey: 'completedOrderCount', className: 'completed' }
] as const;

function ShopCard3D({ children, className = '', ...cardProps }: ComponentProps<typeof Card> & { children: ReactNode }) {
  const [style, setStyle] = useState<CSSProperties>({});

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const rotateX = ((event.clientY - rect.top) / rect.height - 0.5) * -4.5;
    const rotateY = ((event.clientX - rect.left) / rect.width - 0.5) * 6;
    setStyle({ '--shop-card-rotate-x': `${rotateX}deg`, '--shop-card-rotate-y': `${rotateY}deg` } as CSSProperties);
  }

  return (
    <Card
      className={`shop-card ${className}`}
      style={style}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setStyle({})}
      {...cardProps}
    >
      {children}
    </Card>
  );
}

export default function ShopsPage({
  shops,
  loading,
  loadError,
  reloadShops,
  openShopOrders
}: ShopsPageProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ShopFormValues>();
  const [editingShop, setEditingShop] = useState<Shop>();
  const [modalMode, setModalMode] = useState<ShopModalMode>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number>();
  const [products, setProducts] = useState<string[]>([]);
  const [productDraft, setProductDraft] = useState('');
  const [productInputVisible, setProductInputVisible] = useState(false);

  useEffect(() => {
    if (!modalOpen) return;
    form.setFieldsValue({
      shop: editingShop?.shop ?? '',
      shopName: editingShop?.shopName ?? '',
      settlementCurrency: editingShop?.settlementCurrency ?? 'USD',
      wecomRobotWebhookUrl: editingShop?.wecomRobotWebhookUrl ?? ''
    });
  }, [editingShop, form, modalOpen]);

  function openShopModal(shop?: Shop, mode: ShopModalMode = shop ? 'edit' : 'create') {
    setEditingShop(shop);
    setModalMode(mode);
    setProducts(shop?.products ?? []);
    setProductDraft('');
    setProductInputVisible(false);
    setModalOpen(true);
  }

  function closeShopModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditingShop(undefined);
    setModalMode('create');
    form.resetFields();
  }

  function addProduct() {
    const nextProduct = productDraft.trim();
    if (!nextProduct) return;
    if (products.includes(nextProduct)) {
      message.warning('该商品已添加');
      return;
    }
    setProducts((current) => [...current, nextProduct]);
    setProductDraft('');
    setProductInputVisible(false);
  }

  async function submitShop() {
    const values = await form.validateFields();
    const payload: ShopPayload = {
      shop: values.shop.trim(),
      shopName: values.shopName.trim(),
      settlementCurrency: values.settlementCurrency,
      wecomRobotWebhookUrl: values.wecomRobotWebhookUrl?.trim() ?? '',
      products
    };

    setSubmitting(true);
    try {
      if (editingShop) {
        await browserAlbumApi.shops.update(editingShop.id, payload);
        message.success('店铺编辑成功');
      } else {
        await browserAlbumApi.shops.create(payload);
        message.success('店铺新增成功');
      }
      setModalOpen(false);
      setEditingShop(undefined);
      form.resetFields();
      await reloadShops();
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteShop(shop: Shop) {
    setDeletingId(shop.id);
    try {
      await browserAlbumApi.shops.delete(shop.id);
      message.success(`已删除店铺“${shop.shopName || shop.shop}”`);
      await reloadShops();
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingId(undefined);
    }
  }

  const content = loading && shops.length === 0 ? (
    <div className="shop-grid" aria-label="正在加载店铺">
      {Array.from({ length: 3 }, (_, index) => (
        <Card className="shop-card" key={index}><Skeleton active paragraph={{ rows: 4 }} /></Card>
      ))}
    </div>
  ) : loadError && shops.length === 0 ? (
    <div className="shops-feedback">
      <Result
        status="error"
        title="店铺加载失败"
        subTitle={loadError}
        extra={<Button type="primary" icon={<ReloadOutlined />} onClick={() => void reloadShops()}>重新加载</Button>}
      />
    </div>
  ) : shops.length === 0 ? (
    <div className="shops-feedback"><Empty description="暂无店铺数据" /></div>
  ) : (
    <div className="shop-grid">
      {shops.map((shop) => (
        <ShopCard3D
          key={shop.id}
          title={(
            <div className="shop-card-heading">
              <span className="shop-card-code">{shop.shop || '-'}</span>
              <strong>{shop.shopName || '未命名店铺'}</strong>
            </div>
          )}
          extra={(
            <div className="shop-card-actions">
              <Tooltip title="编辑店铺">
                <Button
                  type="text"
                  size="small"
                  aria-label={`编辑店铺 ${shop.shopName || shop.shop}`}
                  icon={<EditOutlined />}
                  onClick={() => openShopModal(shop, 'edit')}
                />
              </Tooltip>
              <Popconfirm
                title="删除店铺"
                description={`确定删除“${shop.shopName || shop.shop}”吗？`}
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true, loading: deletingId === shop.id }}
                onConfirm={() => deleteShop(shop)}
              >
                <Tooltip title="删除店铺">
                  <Button
                    type="text"
                    danger
                    size="small"
                    aria-label={`删除店铺 ${shop.shopName || shop.shop}`}
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </div>
          )}
        >
          <div className="shop-metrics">
            <button
              type="button"
              className="shop-metric-button"
              aria-label={`查看 ${shop.shopName || shop.shop} 的商品详情`}
              onClick={() => openShopModal(shop, 'view')}
            >
              <Statistic title="商品数" value={shop.productCount} prefix={<AppstoreOutlined />} />
            </button>
            <button
              type="button"
              className="shop-metric-button"
              aria-label={`查看 ${shop.shopName || shop.shop} 的订单`}
              onClick={() => openShopOrders(shop)}
            >
              <Statistic title="订单数" value={shop.orderCount} prefix={<ShoppingCartOutlined />} />
            </button>
            <Statistic title="尺寸模板数" value={shop.sizeTemplateCount} prefix={<ColumnWidthOutlined />} />
            <Statistic title="字体模板数" value={shop.fontTemplateCount} prefix={<FontSizeOutlined />} />
          </div>
          <div className="shop-order-statuses" aria-label="订单状态统计">
            <span className="shop-order-status-title">订单状态</span>
            <div className="shop-order-status-grid">
              {shopOrderStatuses.map((item) => (
                <button
                  type="button"
                  className={`shop-order-status shop-order-status-${item.className}`}
                  aria-label={`查看 ${shop.shopName || shop.shop} 的${item.label}订单`}
                  key={item.status}
                  onClick={() => openShopOrders(shop, item.status)}
                >
                  <span>{item.label}</span>
                  <strong>{shop[item.countKey]}</strong>
                </button>
              ))}
            </div>
          </div>
        </ShopCard3D>
      ))}
    </div>
  );

  return (
    <section className="panel shops-panel">
      <header className="panel-header shops-header">
        <div className="shops-heading">
          <h1>店铺管理</h1>
          <p>共 {shops.length} 个店铺</p>
        </div>
        <Space className="shops-toolbar" wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openShopModal()}>
            新增店铺
          </Button>
          <Button icon={<ReloadOutlined spin={loading} />} loading={loading} onClick={() => void reloadShops()}>
            刷新店铺
          </Button>
        </Space>
      </header>
      {content}

      <Modal
        title={modalMode === 'view' ? '店铺商品详情' : editingShop ? '编辑店铺' : '新增店铺'}
        width={680}
        open={modalOpen}
        okText={editingShop ? '保存' : '新增'}
        cancelText="取消"
        footer={modalMode === 'view' ? (
          <Button type="primary" onClick={closeShopModal}>关闭</Button>
        ) : undefined}
        confirmLoading={submitting}
        onOk={() => void submitShop()}
        onCancel={closeShopModal}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark="optional" className="shop-form">
          <Form.Item
            name="shop"
            label="店铺标识"
            extra="用于接口和订单关联，必须唯一。"
            rules={[{ required: true, whitespace: true, message: '请输入店铺标识' }]}
          >
            <Input placeholder="请输入店铺标识" autoComplete="off" disabled={modalMode === 'view'} />
          </Form.Item>
          <Form.Item
            name="shopName"
            label="店铺名称"
            extra="面向用户显示的店铺名称。"
            rules={[{ required: true, whitespace: true, message: '请输入店铺名称' }]}
          >
            <Input placeholder="请输入店铺名称" autoComplete="off" disabled={modalMode === 'view'} />
          </Form.Item>
          <Form.Item name="settlementCurrency" label="结算币种" rules={[{ required: true, message: '请选择结算币种' }]}>
            <Select disabled={modalMode === 'view'} options={[{ value: 'USD', label: 'USD（美元）' }, { value: 'CAD', label: 'CAD（加元）' }]} />
          </Form.Item>
          <Form.Item
            name="wecomRobotWebhookUrl"
            label="企业微信机器人"
            extra="可选，填写企业微信群机器人的 Webhook 地址。"
          >
            <Input
              placeholder="请输入企业微信机器人 Webhook 地址"
              autoComplete="off"
              disabled={modalMode === 'view'}
            />
          </Form.Item>
          <Form.Item
            label="店铺商品"
            extra={modalMode === 'view' ? `共 ${products.length} 个商品` : '输入商品名称后按回车或点击加号；点击标签内减号可删除。'}
          >
            <div className="shop-product-editor">
              <div className="shop-product-tags">
                {products.map((product) => (
                  <Tag className="shop-product-tag" key={product}>
                    <span>{product}</span>
                    {modalMode !== 'view' && (
                      <button
                        type="button"
                        className="shop-product-remove"
                        aria-label={`删除商品 ${product}`}
                        onClick={() => setProducts((current) => current.filter((item) => item !== product))}
                      >
                        <MinusOutlined />
                      </button>
                    )}
                  </Tag>
                ))}
                {modalMode === 'view' && products.length === 0 ? (
                  <span className="shop-products-empty">暂无商品</span>
                ) : productInputVisible ? (
                  <Input
                    className="shop-product-inline-input"
                    autoFocus
                    value={productDraft}
                    placeholder="商品名称"
                    onBlur={() => {
                      if (productDraft.trim()) addProduct();
                      else setProductInputVisible(false);
                    }}
                    onChange={(event) => setProductDraft(event.target.value)}
                    onPressEnter={(event) => {
                      event.preventDefault();
                      addProduct();
                    }}
                  />
                ) : modalMode !== 'view' ? (
                  <Tag
                    className="shop-product-add-tag"
                    role="button"
                    tabIndex={0}
                    onClick={() => setProductInputVisible(true)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') setProductInputVisible(true);
                    }}
                  >
                    <PlusOutlined /> 添加商品
                  </Tag>
                ) : null}
              </div>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
