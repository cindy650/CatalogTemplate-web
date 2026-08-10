import { Button, Card, Empty, Tag } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import type { TemplatePageProps } from '../types';

export default function TemplatesPage({ templates, openTemplate }: TemplatePageProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h1>模板管理</h1>
          <p>保存、另存为和订单生成模板都会进入版本记录。</p>
        </div>
      </header>
      {templates.length > 0 ? (
        <div className="grid-list">
          {templates.map((template) => (
            <Card
              className="template-card"
              key={template.id}
              title={template.name}
              extra={<Tag color="blue">v{template.version}</Tag>}
              actions={[
                <Button key="open" type="link" icon={<FolderOpenOutlined />} onClick={() => void openTemplate(template.id)}>打开</Button>
              ]}
            >
              <div className="template-meta">
                <span>来源：{template.sourceKind}</span>
                <span>更新：{new Date(template.updatedAt).toLocaleString()}</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="empty-surface"><Empty description="暂无模板，请从订单生成或在编辑器中保存" /></div>
      )}
    </section>
  );
}
