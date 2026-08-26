import { Card, Empty, Tag } from 'antd';
import { AppstoreOutlined, PictureOutlined } from '@ant-design/icons';
import type { InnerPagesPageProps } from '../types';

function getShopName(shop?: InnerPagesPageProps['shops'][number]): string {
  return shop?.shopName || shop?.shop || '未命名店铺';
}

export default function InnerPagesPage({ shops, products, selectedShopId, selectedProductId }: InnerPagesPageProps) {
  const shop = shops.find((item) => item.id === selectedShopId);
  const product = products.find((item) => item.id === selectedProductId);

  if (!shop || !product) {
    return (
      <section className="panel inner-pages-page inner-pages-empty">
        <Empty image={<AppstoreOutlined />} description={shops.length && products.length ? '请从左侧选择店铺和产品' : '暂无可用的店铺或产品'} />
      </section>
    );
  }

  const entries = product.productNames.length > 0 ? product.productNames : [product.name || '默认内页'];

  return (
    <section className="panel inner-pages-page">
      <header className="inner-pages-header">
        <div>
          <span>内页模块</span>
          <h1>{getShopName(shop)} / {product.name || '未命名产品'}</h1>
        </div>
        <span className="inner-pages-count">{entries.length} 个模块</span>
      </header>

      <div className="inner-pages-grid">
        {entries.map((entry, index) => (
          <Card className="inner-page-card" key={`${entry}-${index}`}>
            <div className={`inner-page-preview inner-page-preview-${index % 3}`} role="img" aria-label={`${entry} 内页预览图`}>
              <div className="inner-page-preview-sheet">
                <span />
                <span />
                <span />
              </div>
              <div className="inner-page-preview-label"><PictureOutlined />预览图</div>
            </div>
            <div className="inner-page-card-title">
              <div>
                <strong>{entry}</strong>
                <span>内页模块</span>
              </div>
              <Tag variant="filled">待配置</Tag>
            </div>
            <div className="inner-page-specification">
              <span>规格</span>
              <strong>待配置</strong>
            </div>
            <div className="inner-page-card-meta">
              <span>{getShopName(shop)}</span>
              <span>{product.name || '未命名产品'}</span>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
