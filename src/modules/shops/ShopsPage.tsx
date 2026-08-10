import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Empty, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';

type ShopRow = {
  id: string;
  name: string;
  code: string;
  status: 'enabled' | 'disabled';
  note: string;
};

const shops: ShopRow[] = [];

export default function ShopsPage() {
  const columns: ColumnsType<ShopRow> = [
    { title: '店铺名称', dataIndex: 'name', width: 220 },
    { title: '店铺代码', dataIndex: 'code', width: 160 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: ShopRow['status']) => (
        <Tag color={status === 'enabled' ? 'success' : 'default'}>
          {status === 'enabled' ? '启用' : '停用'}
        </Tag>
      )
    },
    { title: '备注', dataIndex: 'note' }
  ];

  return (
    <section className="panel shops-panel">
      <header className="panel-header">
        <div>
          <h1>店铺管理</h1>
          <p>维护订单来源店铺及店铺基础信息。</p>
        </div>
        <Space>
          <Button icon={<EditOutlined />} disabled>编辑</Button>
          <Button danger icon={<DeleteOutlined />} disabled>删除</Button>
          <Button type="primary" icon={<PlusOutlined />} disabled>新增店铺</Button>
        </Space>
      </header>

      <div className="table-card">
        <Table<ShopRow>
          columns={columns}
          dataSource={shops}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无店铺数据" /> }}
        />
      </div>
    </section>
  );
}
