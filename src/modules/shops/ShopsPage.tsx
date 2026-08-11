import {
  AppstoreOutlined,
  ColumnWidthOutlined,
  FontSizeOutlined,
  ReloadOutlined,
  ShopOutlined,
  ShoppingCartOutlined
} from '@ant-design/icons';
import { Button, Card, Empty, Result, Skeleton, Statistic } from 'antd';
import type { ShopsPageProps } from '../types';

export default function ShopsPage({ shops, loading, loadError, reloadShops }: ShopsPageProps) {
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
        <Card
          className="shop-card"
          key={shop.id}
          title={(
            <div className="shop-card-heading">
              <span className="shop-card-code">{shop.shop || '-'}</span>
              <strong>{shop.shopName || '未命名店铺'}</strong>
            </div>
          )}
          extra={<ShopOutlined className="shop-card-icon" />}
        >
          <div className="shop-metrics">
            <Statistic title="产品数" value={shop.productCount} prefix={<AppstoreOutlined />} />
            <Statistic title="订单数" value={shop.orderCount} prefix={<ShoppingCartOutlined />} />
            <Statistic title="尺寸模板数" value={shop.sizeTemplateCount} prefix={<ColumnWidthOutlined />} />
            <Statistic title="字体模板数" value={shop.fontTemplateCount} prefix={<FontSizeOutlined />} />
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <section className="panel shops-panel">
      <header className="panel-header">
        <div>
          <h1>店铺管理</h1>
          <p>共 {shops.length} 个店铺</p>
        </div>
        <Button icon={<ReloadOutlined spin={loading} />} loading={loading} onClick={() => void reloadShops()}>
          刷新店铺
        </Button>
      </header>
      {content}
    </section>
  );
}
