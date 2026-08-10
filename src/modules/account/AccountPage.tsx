import { useEffect } from 'react';
import { App, Button, Form, Input, Select } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import type { LocalUserProfile } from '@shared/domain';
import type { AccountPageProps } from '../types';
import { browserAlbumApi } from '../../api';

export default function AccountPage({ account, setAccount, setStatus }: AccountPageProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<LocalUserProfile>();

  useEffect(() => {
    if (account) form.setFieldsValue(account);
  }, [account, form]);

  if (!account) return null;

  async function saveAccount(values: LocalUserProfile) {
    try {
      const next = await browserAlbumApi.user.update({ ...account!, ...values });
      setAccount(next);
      setStatus('账号资料已保存');
      message.success('账号资料已保存');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus(`账号资料保存失败：${errorMessage}`);
      message.error(`保存失败：${errorMessage}`);
    }
  }

  return (
    <section className="panel narrow">
      <header className="panel-header">
        <div>
          <h1>账号</h1>
          <p>当前账号资料保存在浏览器本地，为后续接入后端账号与权限预留字段。</p>
        </div>
      </header>
      <Form<LocalUserProfile>
        form={form}
        className="account-form"
        layout="vertical"
        requiredMark={false}
        onFinish={(values) => void saveAccount(values)}
      >
        <Form.Item label="显示名称" name="displayName" rules={[{ required: true, message: '请输入显示名称' }]}>
          <Input placeholder="请输入显示名称" />
        </Form.Item>
        <Form.Item label="邮箱" name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效的邮箱地址' }]}>
          <Input placeholder="name@example.com" />
        </Form.Item>
        <Form.Item label="角色" name="role" rules={[{ required: true, message: '请选择角色' }]}>
          <Select options={[
            { value: 'admin', label: '管理员' },
            { value: 'designer', label: '设计师' },
            { value: 'operator', label: '操作员' }
          ]} />
        </Form.Item>
        <Form.Item className="account-form-actions">
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>保存账号</Button>
        </Form.Item>
      </Form>
    </section>
  );
}
