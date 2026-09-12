import { App, Button, Card, Empty, Result, Tooltip } from 'antd';
import { DownOutlined, DragOutlined, SendOutlined, TranslationOutlined, UpOutlined } from '@ant-design/icons';
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { Order, ProductCategory, Shop } from '@shared/domain';
import { browserAlbumApi } from '../../api';
import { ImageMapEditor } from '../../image-map-editor/editor-entry';
import type {
  ImageMapEditorDocumentValue,
  ImageMapFontLayoutLayerData,
  ImageMapSizeSchemeValue
} from '../../image-map-editor/editor-entry';
import {
  createFontLayout,
  deleteFontLayout,
  applyTextFont,
  loadFontLayoutCategories,
  loadFontLayoutProducts,
  loadFontLayouts,
  loadTextFonts,
  loadTextGenerationRules,
  saveFontLayout,
  updateFontLayout
} from '../imageMapEditorTest/imageMapEditorHost';

interface OrderTemplateEditorPageProps {
  order: Order;
  shops: Shop[];
  products: ProductCategory[];
  saveTemplate?(order: Order, templateJson: Record<string, unknown>): void | Promise<void>;
  reloadOrders?(): Promise<void>;
  onExit(): void;
}

function finiteNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function orderSizeScheme(order: Order, product?: ProductCategory): ImageMapSizeSchemeValue {
  const snapshot = order.matchedTemplate;
  const bleedDetails = snapshot.bleed_details && typeof snapshot.bleed_details === 'object' && !Array.isArray(snapshot.bleed_details)
    ? snapshot.bleed_details as Record<string, unknown>
    : {};
  const horizontalBleed = bleedDetails.horizontal ?? bleedDetails.horizontalBleed ?? bleedDetails.left ?? snapshot.horizontal_bleed ?? snapshot.horizontalBleed ?? snapshot.bleed;
  const verticalBleed = bleedDetails.vertical ?? bleedDetails.verticalBleed ?? bleedDetails.top ?? snapshot.vertical_bleed ?? snapshot.verticalBleed ?? snapshot.bleed;
  const selectedSize = String(snapshot.selected_size ?? snapshot.selectedSize ?? 'order-size');
  const unitValue = String(snapshot.size_unit ?? snapshot.sizeUnit ?? 'in');
  const unit = unitValue === 'cm' || unitValue === 'mm' ? unitValue : 'in';

  return {
    id: selectedSize,
    idIsPersisted: true,
    label: selectedSize,
    unit,
    pageCount: finiteNumber(snapshot.page_count ?? snapshot.pageCount, 50),
    pageCountOptions: [finiteNumber(snapshot.page_count ?? snapshot.pageCount, 50)],
    sideWidth: finiteNumber(snapshot.single_side_width ?? snapshot.singleSideWidth, 9),
    sideHeight: finiteNumber(snapshot.single_side_height ?? snapshot.singleSideHeight, 6),
    bleed: finiteNumber(snapshot.bleed ?? horizontalBleed ?? verticalBleed),
    horizontalBleed: finiteNumber(horizontalBleed),
    verticalBleed: finiteNumber(verticalBleed),
    spineWidthMode: 'fixed',
    spineWidth: finiteNumber(snapshot.spine_width ?? snapshot.spineWidth),
    minSpineWidth: finiteNumber(snapshot.spine_width ?? snapshot.spineWidth),
    maxSpineWidth: finiteNumber(snapshot.spine_width ?? snapshot.spineWidth),
    spineBleed: finiteNumber(snapshot.spine_bleed ?? snapshot.spineBleed),
    backCoverSafeDistance: product?.backCoverSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
    coverSafeDistance: product?.coverSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
    spineSafeDistance: product?.spineSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
    paperThickness: 0
  };
}

function arrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    : [];
}

function orderLayers(order: Order): ImageMapFontLayoutLayerData | undefined {
  const document = order.resolvedLayers;
  const nested = document.layers && typeof document.layers === 'object' && !Array.isArray(document.layers)
    ? document.layers as Record<string, unknown>
    : {};
  const objects = arrayValue(document.objects).length
    ? arrayValue(document.objects)
    : arrayValue(nested.objects);
  if (objects.length === 0) return undefined;

  return {
    objects,
    animations: arrayValue(document.animations).length ? arrayValue(document.animations) : arrayValue(nested.animations),
    styles: arrayValue(document.styles).length ? arrayValue(document.styles) : arrayValue(nested.styles),
    dataSources: arrayValue(document.dataSources).length ? arrayValue(document.dataSources) : arrayValue(nested.dataSources)
  };
}

function savedOrderTemplateJson(
  order: Order,
  document: ImageMapEditorDocumentValue
): Record<string, unknown> {
  const currentLayers = document.layers;
  const originalNestedLayers = order.resolvedLayers.layers;
  const hasNestedLayers = Boolean(
    originalNestedLayers
    && typeof originalNestedLayers === 'object'
    && !Array.isArray(originalNestedLayers)
  );

  return {
    ...order.resolvedLayers,
    version: '7.4.0',
    objects: currentLayers.objects,
    animations: currentLayers.animations,
    styles: currentLayers.styles,
    dataSources: currentLayers.dataSources,
    ...(hasNestedLayers ? {
      layers: {
        ...originalNestedLayers as Record<string, unknown>,
        ...currentLayers
      }
    } : {})
  };
}

function resolveOrderProduct(order: Order, products: ProductCategory[]): ProductCategory | undefined {
  if (order.productId !== undefined) {
    const productById = products.find((item) => item.id === order.productId);
    if (productById) return productById;
  }

  const orderProductName = (order.raw.product || order.items[0]?.productName || '').trim().toLocaleLowerCase();
  if (!orderProductName) return undefined;
  return products.find((product) => [product.name, ...product.productNames]
    .some((name) => name.trim().toLocaleLowerCase() === orderProductName));
}

export default function OrderTemplateEditorPage({ order, shops, products, saveTemplate, reloadOrders, onExit }: OrderTemplateEditorPageProps) {
  const { message } = App.useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number }>();
  const [cardPosition, setCardPosition] = useState<{ left: number; top: number }>();
  const [productInformationExpanded, setProductInformationExpanded] = useState(true);
  const [translatedProductInformation] = useState<Record<string, string>>({});
  const [sendingPreview, setSendingPreview] = useState(false);
  const [previewSent, setPreviewSent] = useState(false);
  const initialLayers = orderLayers(order);

  useEffect(() => {
    const moveCard = (event: MouseEvent) => {
      const drag = dragRef.current;
      const container = containerRef.current;
      const card = cardRef.current;
      if (!drag || !container || !card) return;
      const containerBounds = container.getBoundingClientRect();
      const maxLeft = Math.max(8, container.clientWidth - card.offsetWidth - 8);
      const maxTop = Math.max(8, container.clientHeight - card.offsetHeight - 8);
      setCardPosition({
        left: Math.min(maxLeft, Math.max(8, event.clientX - containerBounds.left - drag.offsetX)),
        top: Math.min(maxTop, Math.max(8, event.clientY - containerBounds.top - drag.offsetY))
      });
    };
    const stopDragging = () => {
      dragRef.current = undefined;
    };
    window.addEventListener('mousemove', moveCard);
    window.addEventListener('mouseup', stopDragging);
    return () => {
      window.removeEventListener('mousemove', moveCard);
      window.removeEventListener('mouseup', stopDragging);
    };
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const card = cardRef.current;
    if (!cardPosition || !container || !card) return;
    const maxLeft = Math.max(8, container.clientWidth - card.offsetWidth - 8);
    const maxTop = Math.max(8, container.clientHeight - card.offsetHeight - 8);
    const nextPosition = {
      left: Math.min(maxLeft, Math.max(8, cardPosition.left)),
      top: Math.min(maxTop, Math.max(8, cardPosition.top))
    };
    if (nextPosition.left !== cardPosition.left || nextPosition.top !== cardPosition.top) {
      setCardPosition(nextPosition);
    }
  }, [cardPosition, productInformationExpanded]);

  if (!initialLayers) {
    return (
      <div className="image-map-editor-test-page template-library-editor-loading">
        <Result
          status="warning"
          title="订单模板暂不可编辑"
          subTitle="订单中没有可加载的 resolved_layers 模板图层。"
        />
      </div>
    );
  }

  const snapshotShopId = finiteNumber(order.matchedTemplate.shop_id ?? order.matchedTemplate.shopId);
  const shopId = order.shopId ?? (snapshotShopId > 0 ? snapshotShopId : undefined);
  const snapshotProductId = finiteNumber(order.matchedTemplate.product_id ?? order.matchedTemplate.productId);
  const productId = order.productId ?? (snapshotProductId > 0 ? snapshotProductId : undefined);
  const product = resolveOrderProduct(order, products)
    ?? (productId !== undefined ? products.find((item) => item.id === productId) : undefined);
  const sizeScheme = orderSizeScheme(order, product);
  const layoutId = finiteNumber(order.resolvedLayers.id);
  const productInformation = Object.entries(order.productInformation)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => ({
      key,
      label: order.productInformationLabels[key] || key,
      value,
      translation: translatedProductInformation[key] || ''
    }));

  const requestProductInformationTranslation = () => {
    message.info('翻译接口暂未接入，当前先展示原始商品信息。');
  };

  const sendPreviewImages = async () => {
    setSendingPreview(true);
    try {
      await browserAlbumApi.orders.sendPreviewImages(order);
      await reloadOrders?.();
      setPreviewSent(true);
      message.success(`订单 ${order.orderNo} 的示意图已发送`);
    } catch (error) {
      message.error(`订单 ${order.orderNo} 发送示意图失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSendingPreview(false);
    }
  };

  const startDragging = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !containerRef.current || !cardRef.current) return;
    const containerBounds = containerRef.current.getBoundingClientRect();
    const cardBounds = cardRef.current.getBoundingClientRect();
    dragRef.current = {
      offsetX: event.clientX - cardBounds.left,
      offsetY: event.clientY - cardBounds.top
    };
    setCardPosition({
      left: cardBounds.left - containerBounds.left,
      top: cardBounds.top - containerBounds.top
    });
    event.preventDefault();
  };

  return (
    <div ref={containerRef} className="image-map-editor-test-page order-template-editor-page">
      <ImageMapEditor
        key={`order-template-${order.id}`}
        initialTheme="light"
        initialBasicInfo={{ shopId, templateName: `订单 ${order.orderNo}` }}
        initialProductId={productId}
        initialLayers={initialLayers}
        initialSizeSchemes={[sizeScheme]}
        initialActiveSizeSchemeId={sizeScheme.id}
        skipTextSafeAreaCheck={product?.useSafeDistance === false}
        selectedFontLayoutId={layoutId > 0 ? layoutId : undefined}
        hiddenActivities={['basicInfo', 'canvas']}
        saveConfirmTitle="确认修改订单"
        saveButtonPrimary
        headerActionsBeforeSave={order.status === 0 && !previewSent ? (
          <Button
            className="rde-order-preview-btn"
            type="primary"
            size="small"
            icon={<SendOutlined />}
            loading={sendingPreview}
            disabled={sendingPreview}
            onClick={() => void sendPreviewImages()}
          >
            发送示意图
          </Button>
        ) : null}
        alwaysEnableSave
        onSaveDocument={saveTemplate
          ? (document) => saveTemplate(order, savedOrderTemplateJson(order, document))
          : undefined}
        onExit={onExit}
        exitLabel="返回订单列表"
        shops={shops.map((shop) => ({
          value: shop.id,
          label: shop.shopName || shop.shop || '未命名店铺'
        }))}
        createFontLayout={createFontLayout}
        deleteFontLayout={deleteFontLayout}
        loadFontLayoutCategories={loadFontLayoutCategories}
        loadFontLayoutProducts={loadFontLayoutProducts}
        loadFontLayouts={(currentShopId, currentProductId) => loadFontLayouts(currentShopId, currentProductId === undefined ? productId : Number(currentProductId))}
        applyTextFont={applyTextFont}
        loadTextFonts={loadTextFonts}
        loadTextGenerationRules={loadTextGenerationRules}
        saveFontLayout={saveFontLayout}
        updateFontLayout={updateFontLayout}
      />
      <div
        ref={cardRef}
        className="order-product-information-card"
        style={cardPosition ? { left: cardPosition.left, top: cardPosition.top, right: 'auto' } : undefined}
      >
        <Card
          size="small"
          title={(
            <div
              className="order-product-information-drag-handle"
              onMouseDown={startDragging}
            >
              <div className="order-product-information-heading">
                <span className="order-product-information-title-row">
                  <DragOutlined />
                  <span className="order-product-information-title">商品信息</span>
                </span>
                <span className="order-product-information-order-number">订单号：{order.orderNo}</span>
              </div>
            </div>
          )}
          extra={(
            <div className="order-product-information-header-actions">
              <Tooltip title="翻译商品信息">
                <Button
                  size="small"
                  icon={<TranslationOutlined />}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    requestProductInformationTranslation();
                  }}
                >
                  翻译
                </Button>
              </Tooltip>
              <Tooltip title={productInformationExpanded ? '收起商品信息' : '展开商品信息'}>
                <Button
                  type="text"
                  size="small"
                  icon={productInformationExpanded ? <UpOutlined /> : <DownOutlined />}
                  aria-label={productInformationExpanded ? '收起商品信息' : '展开商品信息'}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setProductInformationExpanded((expanded) => !expanded);
                  }}
                />
              </Tooltip>
            </div>
          )}
        >
          {productInformationExpanded ? (
            <div className="order-product-information-card-body">
              {productInformation.length ? (
                <div className="order-product-information-list">
                  {productInformation.map((item) => (
                    <div className="order-product-information-field" key={item.key}>
                      <div className="order-product-information-field-label">{item.label}</div>
                      <div className="order-product-information-field-source">{item.value}</div>
                      {item.translation ? (
                        <div className="order-product-information-field-translation">
                          {item.translation}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无商品信息" />
              )}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
