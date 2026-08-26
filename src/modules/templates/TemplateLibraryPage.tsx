import { useEffect, useMemo, useState } from 'react';
import { App, Avatar, Button, Card, Empty, Image, Input, Space, Spin, Tag, Tooltip } from 'antd';
import { AppstoreOutlined, EditOutlined, PlusOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import type { CatalogSizeTemplate, Shop } from '@shared/domain';
import { browserAlbumApi } from '../../api';
import type { TemplateLibraryPageProps } from '../types';
import type { TemplateLibraryShopSelection } from '../moduleRegistry';
import ImageMapEditorTestPage from '../imageMapEditorTest/ImageMapEditorTestPage';

function shopName(shop?: Shop): string {
  return shop?.shopName || shop?.shop || '未命名店铺';
}

function TemplateLibraryCard({ template, shops, onOpen }: { template: CatalogSizeTemplate; shops: Shop[]; onOpen(): void }) {
  const shop = shops.find((item) => item.id === template.shopId);
  const currentSize = template.sizeOptions.find((option) => option.id === template.selectedSizeOptionId) ?? template.sizeOptions[0];
  const shopLabel = [template.shop, template.shopName || shopName(shop), template.name || '未命名尺寸模板'].filter(Boolean).join(' ');
  return (
    <Card className="template-library-card" hoverable onClick={onOpen}>
      <div className="template-library-card-preview" onClick={(event) => event.stopPropagation()}>{template.previewImage ? <Image src={template.previewImage} alt={`${template.name} 预览图`} preview={{ src: template.previewImage }} style={{ objectFit: 'cover', objectPosition: 'right center' }} /> : <Avatar shape="square" icon={<SettingOutlined />} />}</div>
      <div className="template-library-card-head">
        <div className="template-library-card-title"><strong>{shopLabel || '未命名尺寸模板'}</strong></div>
        <Tooltip title="进入尺寸模板编辑"><Button type="text" icon={<EditOutlined />} aria-label={`编辑 ${template.name}`} onClick={(event) => { event.stopPropagation(); onOpen(); }} /></Tooltip>
      </div>
      <div className="template-library-card-stats"><div><span>尺寸方案</span><strong>{template.sizeOptions.length}</strong></div><div><span>当前尺寸</span><strong>{template.selectedSizeOptionId || currentSize?.label || '未选择'}</strong></div></div>
      <div className="template-library-card-options">{template.sizeOptions.slice(0, 4).map((option) => <Tag color={option.id === template.selectedSizeOptionId ? 'blue' : undefined} key={option.id}>{option.label || option.id}</Tag>)}</div>
      <div className="template-library-card-footer"><span>{template.updatedAt ? new Date(template.updatedAt).toLocaleDateString() : '未保存'}</span><Button type="link" onClick={(event) => { event.stopPropagation(); onOpen(); }}>打开编辑</Button></div>
    </Card>
  );
}

export default function TemplateLibraryPage({ products, shops, selectedProductId, selectedShopId, onOpenTemplate, onEditProduct, onEditorModeChange }: TemplateLibraryPageProps) {
  const { message } = App.useApp();
  const [templates, setTemplates] = useState<CatalogSizeTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<number | 'new'>();
  const product = products.find((item) => item.id === selectedProductId);
  const visibleTemplates = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase();
    if (!normalized) return templates;
    return templates.filter((template) => [template.name, template.shopName, template.productCategoryName || '', ...template.applicableProducts, ...template.sizeOptions.map((option) => `${option.id} ${option.label}`)].some((value) => value.toLocaleLowerCase().includes(normalized)));
  }, [keyword, templates]);

  useEffect(() => {
    if (!selectedProductId) {
      setTemplates([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const shopId = selectedShopId === 'ALL' ? undefined : selectedShopId;
    void browserAlbumApi.catalogSizeTemplates.list({ productId: selectedProductId, shopId }).then((next) => {
      if (!cancelled) setTemplates(next);
    }).catch((error) => {
      if (!cancelled) {
        setTemplates([]);
        message.error(error instanceof Error ? error.message : String(error));
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [message, selectedProductId, selectedShopId]);

  useEffect(() => {
    onEditorModeChange?.(editingTemplateId !== undefined);
    return () => onEditorModeChange?.(false);
  }, [editingTemplateId, onEditorModeChange]);

  useEffect(() => {
    setEditingTemplateId(undefined);
  }, [selectedProductId, selectedShopId]);

  if (!product) {
    return <section className="panel template-library-page"><Empty image={<AppstoreOutlined />} description={products.length ? '请从左侧选择产品分类' : '暂无产品分类'} /></section>;
  }

  if (editingTemplateId !== undefined) {
    if (editingTemplateId === 'new') {
      return (
        <ImageMapEditorTestPage
          shops={shops}
          initialShopId={selectedShopId === 'ALL' ? undefined : selectedShopId}
          initialProductId={selectedProductId}
          onExit={() => setEditingTemplateId(undefined)}
        />
      );
    }
    const template = templates.find((item) => item.id === editingTemplateId);
    return template ? (
      <ImageMapEditorTestPage
        shops={shops}
        template={template}
        onExit={() => setEditingTemplateId(undefined)}
      />
    ) : <div className="template-library-editor-loading"><Spin size="large" /></div>;
  }

  const currentShop = selectedShopId !== 'ALL' ? shops.find((shop) => shop.id === selectedShopId) : undefined;
  const selectedShopLabel = currentShop ? shopName(currentShop) : '全部';
  return (
    <section className="panel template-library-page">
      <header className="template-library-header">
        <div><h1>{product.name} / {selectedShopLabel}</h1></div>
        <Space><Button icon={<EditOutlined />} onClick={() => onEditProduct(product)}>编辑产品</Button></Space>
      </header>
      <div className="template-library-toolbar">
        <div className="template-library-filter"><Tag color={currentShop ? 'blue' : 'green'}>{currentShop ? shopName(currentShop) : '全部店铺'}</Tag><span>{visibleTemplates.length} 个尺寸模板</span></div>
        <div className="template-library-toolbar-actions">
          <Input allowClear prefix={<SearchOutlined />} placeholder="搜索尺寸模板或商品" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditingTemplateId('new')}>新增模板</Button>
        </div>
      </div>
      {loading ? <div className="template-library-loading"><Spin size="large" /></div> : visibleTemplates.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={keyword ? '没有匹配的尺寸模板' : '当前产品暂无尺寸模板'} /> : <div className="template-library-grid">{visibleTemplates.map((template) => <TemplateLibraryCard key={template.id} template={template} shops={shops} onOpen={() => setEditingTemplateId(template.id)} />)}</div>}
    </section>
  );
}
