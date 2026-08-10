import type { ReactNode } from 'react';
import type { MenuProps } from 'antd';
import {
  FileTextOutlined,
  HistoryOutlined,
  LayoutOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  UserOutlined
} from '@ant-design/icons';
import type { ModuleId } from './types';

type ModuleDefinition = {
  id: ModuleId;
  label: string;
  path: string;
  breadcrumb: string[];
  icon: ReactNode;
};

export const defaultModuleId: ModuleId = 'shops';

export const moduleDefinitions: ModuleDefinition[] = [
  { id: 'shops', label: '店铺', path: '/shops', breadcrumb: ['店铺管理'], icon: <ShopOutlined /> },
  { id: 'orders', label: '订单', path: '/orders', breadcrumb: ['订单管理'], icon: <ShoppingCartOutlined /> },
  { id: 'editor', label: '模板编辑器', path: '/editor', breadcrumb: ['模板编辑器'], icon: <LayoutOutlined /> },
  { id: 'templates', label: '模板', path: '/templates', breadcrumb: ['模板管理'], icon: <FileTextOutlined /> },
  { id: 'exports', label: '导出历史', path: '/exports', breadcrumb: ['导出历史'], icon: <HistoryOutlined /> },
  { id: 'account', label: '账号', path: '/account', breadcrumb: ['账号'], icon: <UserOutlined /> }
];

export const moduleMenuItems: MenuProps['items'] = moduleDefinitions.map(({ id, label, icon }) => ({
  key: id,
  icon,
  label
}));

export function normalizeRoutePath(routePath: string): string {
  const hashlessPath = routePath.replace(/^#/, '').trim();
  const pathWithSlash = hashlessPath.startsWith('/') ? hashlessPath : `/${hashlessPath}`;
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
