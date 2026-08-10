import { Empty, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ExportHistoryEntry } from '@shared/domain';
import type { ExportsPageProps } from '../types';

export default function ExportsPage({ exports }: ExportsPageProps) {
  const columns: ColumnsType<ExportHistoryEntry> = [
    { title: '时间', dataIndex: 'createdAt', width: 180, render: (value: string) => new Date(value).toLocaleString() },
    { title: '格式', dataIndex: 'format', width: 90, render: (value: string) => <Tag color="blue">{value.toUpperCase()}</Tag> },
    { title: '模板', dataIndex: 'templateId', width: 180, ellipsis: true },
    { title: '订单', dataIndex: 'orderId', width: 180, ellipsis: true, render: (value?: string) => value || '-' },
    { title: '文件', dataIndex: 'targetPath', ellipsis: true, render: (value: string) => <Typography.Text title={value}>{value}</Typography.Text> },
    {
      title: '状态', dataIndex: 'status', width: 110,
      render: (value: string) => <Tag color={value === 'created' ? 'success' : value === 'failed' ? 'error' : 'default'}>{value}</Tag>
    }
  ];

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h1>导出历史</h1>
          <p>记录每次导出的格式、文件名、订单和状态。</p>
        </div>
      </header>
      <div className="table-card">
        <Table<ExportHistoryEntry>
          columns={columns}
          dataSource={exports}
          rowKey="id"
          pagination={{ pageSize: 12, hideOnSinglePage: true }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <Empty description="暂无导出记录" /> }}
        />
      </div>
    </section>
  );
}
