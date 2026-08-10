import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Breadcrumb, Button, Layout, Menu, Typography } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import type { ModuleId } from '../modules/types';
import { getModuleDefinition, moduleMenuItems } from '../modules/moduleRegistry';

const { Header, Sider, Content } = Layout;

type AppLayoutProps = {
  activeModule: ModuleId;
  children: ReactNode;
  editorMode?: boolean;
  status: string;
  onModuleChange(moduleId: ModuleId): void;
};

export default function AppLayout({
  activeModule,
  children,
  editorMode = false,
  status,
  onModuleChange
}: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const activeModuleDefinition = getModuleDefinition(activeModule);
  const breadcrumbItems = useMemo(
    () => activeModuleDefinition.breadcrumb.map((title) => ({ title })),
    [activeModuleDefinition]
  );

  return (
    <Layout className="app-shell">
      <Sider
        className="app-sider"
        width={240}
        collapsedWidth={72}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        trigger={null}
        onCollapse={setCollapsed}
      >
        <div className={collapsed ? 'brand brand-collapsed' : 'brand'}>
          <span className="brand-mark">A</span>
          {!collapsed && (
            <div className="brand-copy">
              <strong>相册排版管理</strong>
              <small>订单模板生产工具</small>
            </div>
          )}
        </div>

        <Menu
          className="sidebar-menu"
          mode="inline"
          selectedKeys={[activeModule]}
          items={moduleMenuItems}
          onClick={({ key }) => onModuleChange(key as ModuleId)}
        />

        {!collapsed && <div className="status">{status}</div>}
      </Sider>

      <Layout className="app-main">
        <Header className="app-content-header">
          <Button
            aria-label={collapsed ? '展开侧边导航' : '收起侧边导航'}
            className="app-nav-toggle"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            type="text"
            onClick={() => setCollapsed((current) => !current)}
          />
          <Breadcrumb className="app-breadcrumb" items={breadcrumbItems} />
          <Typography.Text className="app-module-title">{activeModuleDefinition.label}</Typography.Text>
        </Header>

        <Content className={editorMode ? 'workspace workspace-editor' : 'workspace'}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
