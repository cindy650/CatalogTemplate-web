import { useCallback, useEffect, useState } from 'react';
import { App, Button, Empty, Form, Input, Modal, Pagination, Space, Spin, Table } from 'antd';
import type { TableProps } from 'antd';
import { EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { TextGenerationRule } from '@shared/domain';
import { browserAlbumApi } from '../../api';

const pageSize = 9;

function formatDate(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

export default function TextGenerationRulesPage() {
  const { message } = App.useApp();
  const [rules, setRules] = useState<TextGenerationRule[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TextGenerationRule>();
  const [form] = Form.useForm<{ name: string; description: string }>();

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const result = await browserAlbumApi.textGenerationRules.listPage({
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        search
      });
      setRules(result.items);
      setTotal(result.total);
    } catch (error) {
      setRules([]);
      setTotal(0);
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [currentPage, message, search]);

  useEffect(() => { void loadRules(); }, [loadRules]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  function applySearch(value: string) {
    setCurrentPage(1);
    setSearch(value.trim());
  }

  function openCreate() {
    setEditing(undefined);
    form.resetFields();
    setModalOpen(true);
  }

  async function openEdit(rule: TextGenerationRule) {
    setEditing(rule);
    form.setFieldsValue({ name: rule.name, description: rule.description });
    setModalOpen(true);
    setDetailLoading(true);
    try {
      const detail = await browserAlbumApi.textGenerationRules.get(rule.id);
      setEditing(detail);
      form.setFieldsValue({ name: detail.name, description: detail.description });
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setDetailLoading(false);
    }
  }

  async function submit() {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const payload = { name: values.name.trim(), description: values.description?.trim() || '' };
      if (editing) {
        await browserAlbumApi.textGenerationRules.update(editing.id, payload);
        message.success('模板规则描述已更新');
      } else {
        await browserAlbumApi.textGenerationRules.create(payload);
        message.success('模板规则描述已创建');
      }
      setModalOpen(false);
      await loadRules();
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  const columns: TableProps<TextGenerationRule>['columns'] = [
    { title: '规则名称', dataIndex: 'name', key: 'name', width: 220, render: (value: string) => <strong>{value || '未命名规则'}</strong> },
    { title: '规则描述', dataIndex: 'description', key: 'description', render: (value: string) => <span className="text-generation-rule-description">{value || '-'}</span> },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 190, render: formatDate },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 190, render: formatDate },
    { title: '操作', key: 'actions', width: 100, align: 'center', render: (_value, rule) => <Button type="link" icon={<EditOutlined />} onClick={() => void openEdit(rule)}>编辑</Button> }
  ];

  return (
    <section className="panel text-generation-rules-page">
      <header className="text-generation-rules-header">
        <div><span className="text-generation-rules-eyebrow">文案生成配置</span><h1>模板规则描述</h1><p>{total} 条规则</p></div>
        <Space>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadRules()}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增规则</Button>
        </Space>
      </header>
      <div className="text-generation-rules-toolbar">
        <Input.Search allowClear value={keyword} enterButton={<SearchOutlined />} placeholder="搜索规则名称或描述" onChange={(event) => setKeyword(event.target.value)} onSearch={applySearch} onClear={() => applySearch('')} />
      </div>
      {loading ? <div className="text-generation-rules-loading"><Spin size="large" /></div> : rules.length === 0 ? <Empty className="text-generation-rules-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description={search ? '没有匹配的模板规则描述' : '暂无模板规则描述'}><Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增规则</Button></Empty> : <div className="text-generation-rules-table"><Table<TextGenerationRule> rowKey="id" columns={columns} dataSource={rules} pagination={false} scroll={{ x: 860 }} /></div>}
      <div className="text-generation-rules-pagination"><Pagination current={safeCurrentPage} pageSize={pageSize} total={total} showSizeChanger={false} showLessItems responsive onChange={setCurrentPage} /></div>
      <Modal title={editing ? '编辑模板规则描述' : '新增模板规则描述'} open={modalOpen} onCancel={() => !submitting && setModalOpen(false)} onOk={() => void submit()} okText="保存" cancelText="取消" confirmLoading={submitting} destroyOnHidden>
        {detailLoading ? <div className="text-generation-rules-detail-loading"><Spin /></div> : <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true, whitespace: true, message: '请输入规则名称' }]}><Input maxLength={100} placeholder="例如：婚礼祝福语" /></Form.Item>
          <Form.Item name="description" label="规则描述" rules={[{ required: true, whitespace: true, message: '请输入规则描述' }]}><Input.TextArea rows={5} maxLength={1000} showCount placeholder="描述如何根据业务数据生成文案" /></Form.Item>
        </Form>}
      </Modal>
    </section>
  );
}
