import { useEffect, useMemo, useRef, useState } from 'react';
import { App, Avatar, Button, Card, Empty, Form, Image, Input, Modal, Select, Space, Spin, Tag, Tooltip, Upload } from 'antd';
import { AppstoreOutlined, EditOutlined, InboxOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import type { CatalogSizeTemplate, ProductCategory, Shop } from '@shared/domain';
import { browserAlbumApi } from '../../api';
import type { TemplateLibraryPageProps } from '../types';
import type { TemplateLibraryShopSelection } from '../moduleRegistry';
import ImageMapEditorTestPage from '../imageMapEditorTest/ImageMapEditorTestPage';
import { isOathBookProduct } from '../productRules';
import { createImageMapSizeSchemes, resolveImageMapSpinePageRule } from '../../image-map-editor/editors/imagemap/ImageMapSizeScheme';

const oathBookInitialSizeSchemes = [{
  id: '默认规格',
  idIsPersisted: false,
  label: '默认规格',
  unit: 'mm' as const,
  pageCount: 50,
  pageCountOptions: [50, 100],
  sideWidth: 102.02,
  sideHeight: 140.04,
  bleed: 58,
  separateBleed: true,
  horizontalBleed: 58,
  verticalBleed: 45.97,
  canvasRowGap: 0,
  spineWidthMode: 'fixed' as const,
  spineWidth: 0,
  minSpineWidth: 0,
  maxSpineWidth: 0,
  spineBleed: 0,
  backCoverSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
  coverSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
  spineSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
  paperThickness: 0,
}];

function productInitialSizeSchemes(product: ProductCategory) {
  const safeDistances = {
    backCoverSafeDistance: product.backCoverSafeDistance,
    coverSafeDistance: product.coverSafeDistance,
    spineSafeDistance: product.spineSafeDistance,
    spineWidthBasis: product.spineWidthMode,
    spineWidthFormula: product.spineWidthFormula,
    spineWidthPageRules: product.spineWidthPageRules,
  };
  if (isOathBookProduct(product)) {
    return oathBookInitialSizeSchemes.map((scheme) => ({ ...scheme, ...safeDistances }));
  }
  if (!product.commonSpecValues.length) return [safeDistances];
  return product.commonSpecValues.map((spec, index) => {
    const label = spec.label.trim() || spec.id.trim() || `规格 ${index + 1}`;
    const pageCount = spec.pageCount > 0 ? spec.pageCount : spec.pageCountOptions[0] ?? 50;
    const pageCountOptions = spec.pageCountOptions.length ? spec.pageCountOptions : [pageCount];
    const matchedRule = product.spineWidthMode === 'page_count_table'
      ? resolveImageMapSpinePageRule(product.spineWidthPageRules, pageCount, spec.unit)
      : undefined;
    const doubleBleed = typeof spec.bleed === 'object' ? spec.bleed : undefined;
    const singleBleed = typeof spec.bleed === 'number' ? spec.bleed : Number(doubleBleed?.left ?? doubleBleed?.right ?? 0);
    return {
      id: label,
      idIsPersisted: false,
      label,
      unit: spec.unit,
      pageCount,
      pageCountOptions,
      sideWidth: spec.sideWidth,
      sideHeight: spec.sideHeight,
      bleed: singleBleed,
      ...(doubleBleed ? {
        separateBleed: true,
        horizontalBleed: doubleBleed.left,
        verticalBleed: doubleBleed.right,
      } : {}),
      spineWidthMode: product.spineWidthMode === 'range' ? 'fixed' : 'by_page_count',
      spineWidth: matchedRule?.spineWidth ?? spec.spineWidth,
      minSpineWidth: spec.minSpineWidth,
      maxSpineWidth: spec.maxSpineWidth,
      spineBleed: matchedRule?.spineBleed ?? spec.spineBleed,
      ...(product.spineWidthMode === 'formula' && product.spineWidthFormula ? { spineWidthFormula: product.spineWidthFormula } : {}),
      ...safeDistances,
      paperThickness: spec.paperThickness,
    };
  });
}

function shopName(shop?: Shop): string {
  return shop?.shopName || shop?.shop || '未命名店铺';
}

function TemplateLibraryCard({ template, shops, onOpen }: { template: CatalogSizeTemplate; shops: Shop[]; onOpen(): void }) {
  const shop = shops.find((item) => item.id === template.shopId);
  const currentSize = template.sizeOptions.find((option) => option.id === template.selectedSizeOptionId) ?? template.sizeOptions[0];
  const shopLabel = [template.shop, template.shopName || shopName(shop), template.name || '未命名尺寸模板'].filter(Boolean).join(' ');
  return (
    <Card className="template-library-card" hoverable onClick={onOpen}>
      <div className="template-library-card-preview" onClick={(event) => event.stopPropagation()}>{template.previewImage ? <Image className="template-library-card-preview-image" src={template.previewImage} alt={`${template.name} 预览图`} preview={{ src: template.previewImage }} /> : <Avatar shape="square" icon={<SettingOutlined />} />}</div>
      <div className="template-library-card-head">
        <div className="template-library-card-title">
          <strong>{shopLabel || '未命名尺寸模板'}</strong>
        </div>
        <Tooltip title="进入尺寸模板编辑"><Button type="text" icon={<EditOutlined />} aria-label={`编辑 ${template.name}`} onClick={(event) => { event.stopPropagation(); onOpen(); }} /></Tooltip>
      </div>
      <div className="template-library-card-stats"><div><span>尺寸方案</span><strong>{template.sizeOptions.length}</strong></div><div><span>当前尺寸</span><strong>{template.selectedSizeOptionId || currentSize?.label || '未选择'}</strong></div></div>
      <div className="template-library-card-options">{template.sizeOptions.slice(0, 4).map((option) => <Tag color={option.id === template.selectedSizeOptionId ? 'blue' : undefined} key={option.id}>{option.label || option.id}</Tag>)}</div>
      <div className="template-library-card-footer"><span>id: {template.id} · {template.createdAt ? `创建：${new Date(template.createdAt).toLocaleDateString()}` : '创建时间未知'}</span><Button type="link" onClick={(event) => { event.stopPropagation(); onOpen(); }}>打开编辑</Button></div>
    </Card>
  );
}

export default function TemplateLibraryPage({ products, shops, selectedProductId, selectedShopId, onOpenTemplate, onEditProduct, onEditorModeChange }: TemplateLibraryPageProps) {
  const { message } = App.useApp();
  const [templates, setTemplates] = useState<CatalogSizeTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<number | 'new'>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createPreviewFile, setCreatePreviewFile] = useState<File>();
  const [createPreviewUrl, setCreatePreviewUrl] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm<{ shopId: number; name: string }>();
  const createPreviewUrlRef = useRef<string>();
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
  }, [message, reloadVersion, selectedProductId, selectedShopId]);

  useEffect(() => {
    onEditorModeChange?.(editingTemplateId !== undefined);
    return () => onEditorModeChange?.(false);
  }, [editingTemplateId, onEditorModeChange]);

  useEffect(() => {
    setEditingTemplateId(undefined);
  }, [selectedProductId, selectedShopId]);

  const openCreateModal = () => {
    const defaultShopId = selectedShopId !== 'ALL'
      ? Number(selectedShopId)
      : (product.shopIds[0] ?? shops[0]?.id);
    createForm.setFieldsValue({ shopId: defaultShopId, name: '' });
    if (createPreviewUrlRef.current) URL.revokeObjectURL(createPreviewUrlRef.current);
    createPreviewUrlRef.current = undefined;
    setCreatePreviewFile(undefined);
    setCreatePreviewUrl(undefined);
    setCreateOpen(true);
  };

  const clearCreatePreview = () => {
    if (createPreviewUrlRef.current) URL.revokeObjectURL(createPreviewUrlRef.current);
    createPreviewUrlRef.current = undefined;
    setCreatePreviewFile(undefined);
    setCreatePreviewUrl(undefined);
  };

  useEffect(() => () => {
    if (createPreviewUrlRef.current) URL.revokeObjectURL(createPreviewUrlRef.current);
  }, []);

  const createTemplate = async (values: { shopId: number; name: string }) => {
    if (!product) return;
    const effectiveSchemes = createImageMapSizeSchemes(productInitialSizeSchemes(product));
    const first = effectiveSchemes[0];
    const payload = {
      shopId: Number(values.shopId),
      productId: product.id,
      name: values.name.trim(),
      previewImage: '',
      applicableProducts: [],
      backgroundColor: '#ffffff',
      minSpineWidth: first.minSpineWidth,
      maxSpineWidth: first.maxSpineWidth,
      paperThicknessMm: first.paperThickness,
      spineWidthBasis: first.spineWidthBasis ?? (first.spineWidthMode === 'by_page_count' ? 'page_count_table' : 'range'),
      backCoverSafeDistance: first.backCoverSafeDistance,
      coverSafeDistance: first.coverSafeDistance,
      spineSafeDistance: first.spineSafeDistance,
      selectedSizeOptionId: first.id,
      displayUnit: first.unit,
      pageCount: first.pageCount,
      pageCountOptions: first.pageCountOptions,
      sizeOptions: effectiveSchemes.map((scheme) => ({
          id: scheme.id,
          label: scheme.label,
          fields: {
            size_unit: scheme.unit,
            single_side_width: scheme.sideWidth,
            single_side_height: scheme.sideHeight,
            bleed: scheme.bleed,
            spine_width: scheme.spineWidth,
            spine_bleed: scheme.spineBleed
          }
        })),
      sizeTemplateInfo: [],
      fontLayouts: []
    } satisfies import('@shared/domain').CatalogSizeTemplatePayload;

    setCreating(true);
    try {
      let created = await browserAlbumApi.catalogSizeTemplates.create(payload);
      if (createPreviewFile) {
        const previewImage = await browserAlbumApi.catalogSizeTemplates.uploadPreview(created.id, createPreviewFile);
        created = await browserAlbumApi.catalogSizeTemplates.update(created.id, { ...payload, previewImage });
      }
      setTemplates((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setCreateOpen(false);
      clearCreatePreview();
      setEditingTemplateId(created.id);
      message.success('模板创建成功');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  };

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
          initialSizeSchemes={productInitialSizeSchemes(product)}
          productSafeDistances={product}
          showHeaderSizeSchemeSave
          fontLayoutManagementEnabled
          fontLayoutSyncEnabled
          onExit={() => setEditingTemplateId(undefined)}
        />
      );
    }
    const template = templates.find((item) => item.id === editingTemplateId);
    return template ? (
      <ImageMapEditorTestPage
        shops={shops}
        template={template}
        productSafeDistances={product}
        hideCanvasSection
        showHeaderSizeSchemeSave
        fontLayoutManagementEnabled
        fontLayoutSyncEnabled
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
          <Button
            icon={<ReloadOutlined spin={loading} />}
            loading={loading}
            onClick={() => setReloadVersion((current) => current + 1)}
          >
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新增模板</Button>
        </div>
      </div>
      {loading ? <div className="template-library-loading"><Spin size="large" /></div> : visibleTemplates.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={keyword ? '没有匹配的尺寸模板' : '当前产品暂无尺寸模板'} /> : <div className="template-library-grid">{visibleTemplates.map((template) => <TemplateLibraryCard key={template.id} template={template} shops={shops} onOpen={() => setEditingTemplateId(template.id)} />)}</div>}
      <Modal
        title="新增模板"
        open={createOpen}
        destroyOnHidden
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
        onCancel={() => { setCreateOpen(false); clearCreatePreview(); }}
        onOk={() => createForm.submit()}
      >
        <Form form={createForm} layout="vertical" onFinish={(values) => void createTemplate(values)}>
          <Form.Item name="shopId" label="所属店铺" rules={[{ required: true, message: '请选择所属店铺' }]}>
            <Select placeholder="请选择店铺" options={shops.map((shop) => ({ value: shop.id, label: shopName(shop) }))} />
          </Form.Item>
          <Form.Item name="name" label="模板名称" rules={[{ required: true, whitespace: true, message: '请输入模板名称' }]}>
            <Input placeholder="请输入模板名称" maxLength={100} />
          </Form.Item>
          <Form.Item label="预览图上传" extra="可选，支持 PNG、JPG、JPEG、WEBP，最大 10MB">
            <Upload.Dragger
              accept="image/png,image/jpeg,image/webp"
              maxCount={1}
              showUploadList={false}
              beforeUpload={(file) => {
                if (file.size > 10 * 1024 * 1024) {
                  message.error('预览图不能超过 10MB');
                  return Upload.LIST_IGNORE;
                }
                if (createPreviewUrlRef.current) URL.revokeObjectURL(createPreviewUrlRef.current);
                createPreviewUrlRef.current = URL.createObjectURL(file);
                setCreatePreviewFile(file);
                setCreatePreviewUrl(createPreviewUrlRef.current);
                return false;
              }}
              onRemove={() => { clearCreatePreview(); }}
            >
              {createPreviewFile && createPreviewUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, minHeight: 150, padding: 12 }}>
                  <img src={createPreviewUrl} alt="预览图缩略图" style={{ display: 'block', maxWidth: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 6 }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={createPreviewFile.name}>{createPreviewFile.name}</div>
                    <Button type="link" danger size="small" onClick={(event) => { event.stopPropagation(); clearCreatePreview(); }}>移除图片</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                  <p className="ant-upload-text">点击或拖拽上传预览图</p>
                  <p className="ant-upload-hint">创建模板后会自动上传到预览图存储。</p>
                </>
              )}
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
