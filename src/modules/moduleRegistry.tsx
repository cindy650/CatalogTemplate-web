import type { ReactNode } from 'react';
import type { MenuProps } from 'antd';
import {
  AppstoreOutlined,
  BookOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LayoutOutlined,
  PictureOutlined,
  ColumnWidthOutlined,
  EditOutlined,
  ExperimentOutlined,
  PlusOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  UserOutlined
} from '@ant-design/icons';
import type { ModuleId } from './types';
import type { ProductCategory, Shop } from '@shared/domain';

type ModuleDefinition = {
  id: ModuleId;
  label: string;
  path: string;
  breadcrumb: string[];
  icon: ReactNode;
  menuVisible?: boolean;
};

export const defaultModuleId: ModuleId = 'shops';

export type ProductMenuActions = {
  onAdd(): void;
  onEdit(product: ProductCategory): void;
  onDelete(product: ProductCategory): void;
};

export const moduleDefinitions: ModuleDefinition[] = [
  { id: 'shops', label: '店铺', path: '/shops', breadcrumb: ['店铺管理'], icon: <ShopOutlined /> },
  { id: 'orders', label: '订单', path: '/orders', breadcrumb: ['订单管理'], icon: <ShoppingCartOutlined /> },
  {
    id: 'template-library',
    label: '模板库',
    path: '/template-library',
    breadcrumb: ['模板库'],
    icon: <AppstoreOutlined />
  },
  {
    id: 'font-layouts',
    label: '字体布局',
    path: '/font-layouts',
    breadcrumb: ['模板管理', '字体布局'],
    icon: <LayoutOutlined />,
    menuVisible: false
  },
  { id: 'inner-pages', label: '内页模块', path: '/inner-pages', breadcrumb: ['内页模块'], icon: <BookOutlined /> },
  { id: 'text-generation-rules', label: '模板规则描述', path: '/text-generation-rules', breadcrumb: ['模板规则描述'], icon: <FileTextOutlined /> },
  {
    id: 'size-templates',
    label: '尺寸模板',
    path: '/size-templates',
    breadcrumb: ['模板管理', '尺寸模板'],
    icon: <ColumnWidthOutlined />,
    menuVisible: false
  },
  {
    id: 'editor',
    label: '模板编辑器',
    path: '/editor',
    breadcrumb: ['模板编辑器'],
    icon: <LayoutOutlined />,
    menuVisible: false
  },
  {
    id: 'image-map-test',
    label: '图片地图测试',
    path: '/image-map-test',
    breadcrumb: ['开发测试', '图片地图编辑器'],
    icon: <PictureOutlined />,
    menuVisible: false
  },
  {
    id: 'ui-prototype',
    label: 'UI 原型',
    path: '/ui-prototype',
    breadcrumb: ['设计验证', 'UI 原型'],
    icon: <ExperimentOutlined />,
    menuVisible: false
  },
  {
    id: 'fonts',
    label: '字体库',
    path: '/fonts',
    breadcrumb: ['字体资源', '字体库'],
    icon: <FileTextOutlined />
  },
  { id: 'exports', label: '导出历史', path: '/exports', breadcrumb: ['导出历史'], icon: <HistoryOutlined /> },
  { id: 'account', label: '账号', path: '/account', breadcrumb: ['账号'], icon: <UserOutlined /> }
];

const sizeTemplateShopKeyPrefix = 'size-templates-shop-';
const innerPagesShopKeyPrefix = 'inner-pages-shop-';
const innerPagesProductMarker = '-product-';
const fontLayoutsShopKeyPrefix = 'font-layouts-shop-';
const fontLayoutsProductMarker = '-product-';
const productKeyPrefix = 'template-library-product-';
const productAllKeySuffix = '-all';
const productShopKeySuffix = '-shop-';
const productAddKey = 'template-library-add';

function productMenuLabel(product: ProductCategory, actions?: ProductMenuActions): ReactNode {
  return (
    <span className="sidebar-product-label">
      <span className="sidebar-product-name">{product.name || '未命名产品'}</span>
      {actions && <span className="sidebar-product-actions" onClick={(event) => event.stopPropagation()}>
        <button type="button" aria-label={`编辑产品 ${product.name}`} title="编辑产品" onClick={() => actions.onEdit(product)}><EditOutlined /></button>
      </span>}
    </span>
  );
}

export function getModuleMenuItems(shops: Shop[], products: ProductCategory[] = [], productActions?: ProductMenuActions): MenuProps['items'] {
  return moduleDefinitions
    .filter(({ menuVisible }) => menuVisible !== false)
    .map(({ id, label, icon }) => id === 'template-library' ? {
      key: id,
      icon,
      label,
      children: [
        ...products.map((product) => ({
          key: getProductMenuKey(product.id),
          className: 'sidebar-product-submenu',
          label: productMenuLabel(product, productActions),
          children: [
            { key: getProductAllMenuKey(product.id), className: 'sidebar-template-leaf', label: '全部' },
            ...((product.shops.length > 0 ? product.shops : product.shopIds.map((id) => shops.find((shop) => shop.id === id)).filter(Boolean).map((shop) => ({ id: shop!.id, shop: shop!.shop, shopName: shop!.shopName })))
              .map((shop) => ({ key: getProductShopMenuKey(product.id, shop.id), className: 'sidebar-template-leaf', label: shop.shopName || shop.shop || '未命名店铺' })))
          ]
        })),
        { key: productAddKey, icon: <PlusOutlined />, label: '添加产品' }
      ]
    } : id === 'inner-pages' ? {
      key: id,
      icon,
      label,
      children: shops.map((shop) => {
        const shopProducts = products.filter((product) => (
          product.shopIds.includes(shop.id) || product.shops.some((item) => item.id === shop.id)
        ));
        return {
          key: getInnerPagesShopMenuKey(shop.id),
          className: 'sidebar-inner-pages-shop',
          label: shop.shopName || shop.shop || '未命名店铺',
          children: shopProducts.length > 0
            ? shopProducts.map((product) => ({
              key: getInnerPagesProductMenuKey(shop.id, product.id),
              className: 'sidebar-inner-pages-product',
              label: product.name || '未命名产品'
            }))
            : [{ key: `${getInnerPagesShopMenuKey(shop.id)}-empty`, label: '暂无产品', disabled: true }]
        };
      })
    } : id === 'font-layouts' ? {
      key: id,
      icon,
      label,
      children: shops.map((shop) => {
        const shopProducts = products.filter((product) => (
          product.shopIds.includes(shop.id) || product.shops.some((item) => item.id === shop.id)
        ));
        return {
          key: getFontLayoutsShopMenuKey(shop.id),
          className: 'sidebar-product-submenu',
          label: shop.shopName || shop.shop || '未命名店铺',
          children: shopProducts.length > 0
            ? shopProducts.map((product) => ({
              key: getFontLayoutsProductMenuKey(shop.id, product.id),
              className: 'sidebar-template-leaf',
              label: product.name || '未命名产品'
            }))
            : [{ key: `${getFontLayoutsShopMenuKey(shop.id)}-empty`, label: '暂无产品', disabled: true }]
        };
      })
    } : id === 'size-templates' ? {
      key: id,
      icon,
      label,
      children: shops.map((shop) => ({
        key: `${sizeTemplateShopKeyPrefix}${shop.id}`,
        label: shop.shopName || shop.shop || '未命名店铺'
      }))
    } : {
      key: id,
      icon,
      label
    });
}

export function getInnerPagesShopMenuKey(shopId: number): string {
  return `${innerPagesShopKeyPrefix}${shopId}`;
}

export function getInnerPagesProductMenuKey(shopId: number, productId: number): string {
  return `${getInnerPagesShopMenuKey(shopId)}${innerPagesProductMarker}${productId}`;
}

export function getInnerPagesMenuSelection(menuKey: string): { shopId: number; productId: number } | undefined {
  if (!menuKey.startsWith(innerPagesShopKeyPrefix) || !menuKey.includes(innerPagesProductMarker)) return undefined;
  const [shopPart, productPart] = menuKey.slice(innerPagesShopKeyPrefix.length).split(innerPagesProductMarker);
  const shopId = Number(shopPart);
  const productId = Number(productPart);
  return Number.isInteger(shopId) && Number.isInteger(productId) ? { shopId, productId } : undefined;
}

export function getFontLayoutsShopMenuKey(shopId: number): string {
  return `${fontLayoutsShopKeyPrefix}${shopId}`;
}

export function getFontLayoutsProductMenuKey(shopId: number, productId: number): string {
  return `${getFontLayoutsShopMenuKey(shopId)}${fontLayoutsProductMarker}${productId}`;
}

export function getFontLayoutsMenuSelection(menuKey: string): { shopId: number; productId: number } | undefined {
  if (!menuKey.startsWith(fontLayoutsShopKeyPrefix) || !menuKey.includes(fontLayoutsProductMarker)) return undefined;
  const [shopPart, productPart] = menuKey.slice(fontLayoutsShopKeyPrefix.length).split(fontLayoutsProductMarker);
  const shopId = Number(shopPart);
  const productId = Number(productPart);
  return Number.isInteger(shopId) && Number.isInteger(productId) ? { shopId, productId } : undefined;
}

export function getSizeTemplateShopIdFromMenuKey(menuKey: string): number | undefined {
  if (!menuKey.startsWith(sizeTemplateShopKeyPrefix)) return undefined;
  const shopId = Number(menuKey.slice(sizeTemplateShopKeyPrefix.length));
  return Number.isInteger(shopId) ? shopId : undefined;
}

export function getSizeTemplateShopMenuKey(shopId: number): string {
  return `${sizeTemplateShopKeyPrefix}${shopId}`;
}

export function getProductMenuKey(productId: number): string { return `${productKeyPrefix}${productId}`; }
export function getProductAllMenuKey(productId: number): string { return `${getProductMenuKey(productId)}${productAllKeySuffix}`; }
export function getProductShopMenuKey(productId: number, shopId: number): string { return `${getProductMenuKey(productId)}${productShopKeySuffix}${shopId}`; }
export type TemplateLibraryShopSelection = number | 'ALL';

export function getProductMenuSelection(menuKey: string): { productId: number; shopId: TemplateLibraryShopSelection } | undefined {
  if (!menuKey.startsWith(productKeyPrefix)) return undefined;
  const rest = menuKey.slice(productKeyPrefix.length);
  const productId = Number(rest.split('-')[0]);
  if (!Number.isInteger(productId)) return undefined;
  if (rest.endsWith(productAllKeySuffix)) return { productId, shopId: 'ALL' };
  const shopMarker = productShopKeySuffix.slice(1);
  const shopIndex = rest.indexOf(shopMarker);
  if (shopIndex >= 0) {
    const shopId = Number(rest.slice(shopIndex + shopMarker.length));
    return Number.isInteger(shopId) ? { productId, shopId } : undefined;
  }
  return { productId, shopId: 'ALL' };
}
export function isProductAddMenuKey(menuKey: string): boolean { return menuKey === productAddKey; }

export function normalizeRoutePath(routePath: string): string {
  const hashlessPath = routePath.replace(/^#/, '').trim();
  const pathOnly = hashlessPath.split(/[?#]/, 1)[0];
  const pathWithSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  const normalized = pathWithSlash.replace(/\/+$/, '');
  return normalized || getModuleDefinition(defaultModuleId).path;
}

export function getModuleDefinition(moduleId: ModuleId): ModuleDefinition {
  return moduleDefinitions.find((item) => item.id === moduleId) ?? moduleDefinitions[0];
}

export function getModuleDefinitionByRoute(routePath: string): ModuleDefinition {
  const normalizedPath = normalizeRoutePath(routePath);
  return moduleDefinitions.find((item) => item.path === normalizedPath) ?? getModuleDefinition(defaultModuleId);
}

export function getModulePath(moduleId: ModuleId): string {
  return getModuleDefinition(moduleId).path;
}
