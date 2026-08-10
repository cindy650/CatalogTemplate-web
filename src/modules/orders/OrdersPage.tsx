import { Button, Empty, Result, Table } from 'antd';
import { FileAddOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Order, OrderItem } from '@shared/domain';
import type { OrdersPageProps } from '../types';

type OrderTableRow = {
  order: Order;
  item: OrderItem;
};

const orderFields = [
  ['订单号', ['订单号', '订单编号', 'orderid', 'orderno']],
  ['店铺', ['店铺', 'shop', 'store']],
  ['产品', ['产品', '商品', 'product', 'item']],
  ['规格/尺寸', ['规格/尺寸', '规格尺寸', 'specification', 'size']],
  ['定制信息', ['定制信息', '自定义信息', '备注', 'custominfo', 'note']],
  ['付款方式', ['付款方式', 'payment', 'paymentmethod']],
  ['邮寄地址', ['邮寄地址', '收货地址', 'address', 'shippingaddress']],
  ['交易编号', ['交易编号', 'transactionid', 'transaction']],
  ['数量', ['数量', 'qty', 'quantity']],
  ['价格', ['价格', 'price', 'amount']]
] as const;

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

export default function OrdersPage({
  orders,
  selectedOrderId,
  loading,
  loadError,
  reloadOrders,
  setSelectedOrderId,
  openOrderInEditor
}: OrdersPageProps) {
  const rows = orderRows(orders);
  const columns: ColumnsType<OrderTableRow> = [
    ...orderFields.map(([label, candidates]) => ({
      title: label,
      key: label,
      width: label === '邮寄地址' ? 320 : label === '定制信息' ? 260 : label === '产品' ? 200 : 140,
      render: (_: unknown, { item }: OrderTableRow) => {
        const value = readRawValue(item.raw, candidates) || '-';
        return <span className="order-cell-content">{value}</span>;
      }
    })),
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      align: 'center',
      render: (_: unknown, { order }: OrderTableRow) => (
        <Button
          type="link"
          icon={<FileAddOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            openOrderInEditor(order);
          }}
        >
          生成模板
        </Button>
      )
    }
  ];

  return (
    <section className="panel orders-panel">
      <header className="panel-header">
        <div>
          <h1>订单管理</h1>
          <p>订单数据由后端接口提供。单击行选中订单，双击行进入模板编辑器。</p>
        </div>
        <Button icon={<ReloadOutlined spin={loading} />} loading={loading} onClick={() => void reloadOrders()}>
          刷新列表
        </Button>
      </header>

      <div className="table-card">
        <Table<OrderTableRow>
          className="orders-table"
          columns={columns}
          dataSource={rows}
          bordered
          rowKey={({ order, item }) => `${order.id}:${item.id}`}
          loading={{ spinning: loading, description: '正在加载订单...' }}
          pagination={false}
          scroll={{ x: 1880, y: 'calc(100vh - 210px)' }}
          rowClassName={({ order }) => selectedOrderId === order.id ? 'selected' : ''}
          onRow={({ order }) => ({
            onClick: () => setSelectedOrderId(order.id),
            onDoubleClick: () => openOrderInEditor(order)
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
      </div>
    </section>
  );
}
