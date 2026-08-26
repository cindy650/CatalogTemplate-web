import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Empty, Form, Input, Modal, Pagination, Popconfirm, Space, Switch, Tag, Upload } from 'antd';
import { DeleteOutlined, EditOutlined, FontSizeOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { FontLibraryItem } from '@shared/domain';
import { browserAlbumApi } from '../../api';

const extensions = ['.ttf', '.otf', '.ttc', '.woff', '.woff2', '.fon'];
const pageSize = 25;

export default function FontsPage() {
  const { message } = App.useApp();
  const [fonts, setFonts] = useState<FontLibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FontLibraryItem>();
  const [file, setFile] = useState<File>();
  const [form] = Form.useForm();
  const loadFonts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await browserAlbumApi.fonts.listPage({ limit: pageSize, offset: (currentPage - 1) * pageSize });
      setFonts(result.items);
      setTotal(result.total);
    }
    catch (error) { setFonts([]); setTotal(0); message.error(error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  }, [currentPage, message]);

  useEffect(() => { void loadFonts(); }, [loadFonts]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  function openCreate() { setEditing(undefined); setFile(undefined); form.resetFields(); form.setFieldsValue({ enabled: true }); setModalOpen(true); }
  function openEdit(font: FontLibraryItem) { setEditing(font); setFile(undefined); form.setFieldsValue({ fontName: font.name, fontFamily: font.family, enabled: font.enabled }); setModalOpen(true); }

  async function submit() {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (editing) {
        await browserAlbumApi.fonts.update(editing.id, { fontName: values.fontName, fontFamily: values.fontFamily, enabled: values.enabled });
        message.success('字体已更新');
      } else {
        if (!file) { message.warning('请选择字体文件'); return; }
        await browserAlbumApi.fonts.upload({ file, fontName: values.fontName, fontFamily: values.fontFamily, enabled: values.enabled });
        message.success('字体上传成功');
      }
      setModalOpen(false); await loadFonts();
    } catch (error) { message.error(error instanceof Error ? error.message : String(error)); }
    finally { setSubmitting(false); }
  }

  return <section className="panel fonts-page">
    <header className="fonts-header"><div><span className="fonts-eyebrow">字体资源</span><h1>字体库</h1><p>{total} 个字体</p></div><Space><Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadFonts()}>刷新</Button><Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>上传字体</Button></Space></header>
    {loading ? <div className="fonts-empty">正在加载字体...</div> : fonts.length === 0 ? <Empty className="fonts-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无字体"><Button type="primary" icon={<UploadOutlined />} onClick={openCreate}>上传字体</Button></Empty> : <div className="fonts-grid">{fonts.map((font) => <Card key={font.id} className="font-card"><div className="font-card-icon"><FontSizeOutlined /></div><div className="font-card-copy"><strong>{font.name || '未命名字体'}</strong><span>{font.family || '未设置字体族'}</span><small>{font.filePath ? font.filePath.split('/').pop() : '已上传字体文件'}</small></div><div className="font-card-footer"><Tag color={font.enabled ? 'green' : 'default'}>{font.enabled ? '启用' : '停用'}</Tag><Space size={2}><Button type="text" icon={<EditOutlined />} aria-label={`编辑字体 ${font.name}`} onClick={() => openEdit(font)} /><Popconfirm title="停用字体" description="确定将该字体设为停用吗？" okText="停用" cancelText="取消" onConfirm={() => void browserAlbumApi.fonts.update(font.id, { enabled: false }).then(loadFonts)}><Button type="text" danger icon={<DeleteOutlined />} aria-label={`停用字体 ${font.name}`} /></Popconfirm></Space></div></Card>)}</div>}
    <div className="fonts-pagination"><Pagination current={safeCurrentPage} pageSize={pageSize} total={total} showSizeChanger={false} showLessItems responsive onChange={setCurrentPage} /></div>
    <Modal title={editing ? '编辑字体' : '上传字体'} open={modalOpen} onCancel={() => !submitting && setModalOpen(false)} onOk={() => void submit()} okText="保存" cancelText="取消" confirmLoading={submitting} destroyOnHidden>
      <Form form={form} layout="vertical">
        {!editing && <Form.Item label="字体文件" required><Upload beforeUpload={(next) => { const lower = next.name.toLowerCase(); if (!extensions.some((ext) => lower.endsWith(ext))) { message.error('仅支持 TTF、OTF、TTC、WOFF、WOFF2、FON 文件'); return Upload.LIST_IGNORE; } if (next.size > 50 * 1024 * 1024) { message.error('字体文件不能超过 50MB'); return Upload.LIST_IGNORE; } setFile(next); return false; }} maxCount={1} showUploadList={Boolean(file)}><Button icon={<UploadOutlined />}>选择字体文件</Button></Upload><small>{file?.name || '支持 .ttf、.otf、.ttc、.woff、.woff2、.fon，最大 50MB'}</small></Form.Item>}
        <Form.Item name="fontName" label="字体名称"><Input placeholder="默认使用文件名" /></Form.Item>
        <Form.Item name="fontFamily" label="字体族"><Input placeholder="可选" /></Form.Item>
        <Form.Item name="enabled" label="状态" valuePropName="checked"><Switch checkedChildren="启用" unCheckedChildren="停用" /></Form.Item>
      </Form>
    </Modal>
  </section>;
}
