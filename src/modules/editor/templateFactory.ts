import type { AlbumTemplateDocument, Order } from '@shared/domain';

const nowIso = () => new Date().toISOString();

export function createGeneratedDocument(order: Order): AlbumTemplateDocument {
  const now = nowIso();
  const placeholderTop = Math.max(340, 180 + order.items.length * 110);
  const objects = [
    {
      type: 'Textbox',
      version: '6.0.0',
      left: 64,
      top: 48,
      width: 560,
      fontSize: 38,
      fontFamily: 'Microsoft YaHei',
      fontWeight: 'bold',
      fill: '#111827',
      text: `订单 ${order.orderNo}`
    },
    {
      type: 'Textbox',
      version: '6.0.0',
      left: 64,
      top: 110,
      width: 760,
      fontSize: 22,
      fontFamily: 'Microsoft YaHei',
      fill: '#334155',
      text: `客户：${order.customerName || '未填写'}    状态：${order.status || '未填写'}`
    },
    ...order.items.flatMap((item, index) => {
      const top = 170 + index * 110;
      return [
        {
          type: 'Rect',
          version: '6.0.0',
          left: 64,
          top,
          width: 980,
          height: 84,
          fill: index % 2 === 0 ? '#f8fafc' : '#ffffff',
          stroke: '#d8dee9',
          strokeWidth: 1
        },
        {
          type: 'Textbox',
          version: '6.0.0',
          left: 88,
          top: top + 14,
          width: 620,
          fontSize: 22,
          fontFamily: 'Microsoft YaHei',
          fill: '#1f2937',
          text: `${item.sku || '无 SKU'}  |  ${item.productName || '未命名商品'}`
        },
        {
          type: 'Textbox',
          version: '6.0.0',
          left: 88,
          top: top + 48,
          width: 840,
          fontSize: 16,
          fontFamily: 'Microsoft YaHei',
          fill: '#475569',
          text: `客户自定义信息：${item.customInfo || '无'}    数量：${item.quantity}`
        }
      ];
    }),
    {
      type: 'Rect',
      version: '6.0.0',
      left: 64,
      top: placeholderTop,
      width: 360,
      height: 240,
      fill: '#f8fafc',
      stroke: '#64748b',
      strokeDashArray: [8, 8],
      strokeWidth: 2
    },
    {
      type: 'Textbox',
      version: '6.0.0',
      left: 118,
      top: placeholderTop + 104,
      width: 260,
      fontSize: 22,
      textAlign: 'center',
      fill: '#64748b',
      selectable: false,
      text: '照片占位 / 可替换图片'
    }
  ];

  return {
    schemaVersion: '1.0',
    id: crypto.randomUUID(),
    name: `订单 ${order.orderNo} 排版`,
    source: { kind: 'generated', orderId: order.id },
    pages: [
      {
        id: crypto.randomUUID(),
        name: 'Page 1',
        width: 1200,
        height: 800,
        dpi: 300,
        fabricJson: { version: '6.0.0', objects },
        bindings: []
      }
    ],
    createdAt: now,
    updatedAt: now
  };
}
