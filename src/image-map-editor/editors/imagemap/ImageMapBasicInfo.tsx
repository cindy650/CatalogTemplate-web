import { Button, Form, Image, Input, Select, Upload } from 'antd';
import { InboxOutlined, PictureOutlined, SaveOutlined } from '@ant-design/icons';
import React, { useEffect, useState } from 'react';

import { INSPECTOR_FORM_PROPS, EditorPanelHeader } from '../../components/editor';

export type ImageMapShopValue = string | number;

export interface ImageMapShopOption {
	value: ImageMapShopValue;
	label: string;
}

export interface ImageMapBasicInfoValue {
	shopId?: ImageMapShopValue;
	templateName: string;
}

interface ImageMapBasicInfoProps {
	shops: ImageMapShopOption[];
	value: ImageMapBasicInfoValue;
	onChange: (value: ImageMapBasicInfoValue) => void;
	previewImage?: string;
	saving?: boolean;
	onSave?: (previewFile?: File) => void | boolean | Promise<void | boolean>;
}

const ImageMapBasicInfo = ({ shops, value, onChange, previewImage, saving, onSave }: ImageMapBasicInfoProps) => {
	const [form] = Form.useForm<ImageMapBasicInfoValue>();
	const [previewFile, setPreviewFile] = useState<File>();
	const [previewUrl, setPreviewUrl] = useState('');
	const [uploadError, setUploadError] = useState('');

	useEffect(() => {
		form.setFieldsValue(value);
	}, [form, value]);

	useEffect(() => {
		if (!previewFile) {
			setPreviewUrl(previewImage || '');
			return;
		}
		const objectUrl = URL.createObjectURL(previewFile);
		setPreviewUrl(objectUrl);
		return () => URL.revokeObjectURL(objectUrl);
	}, [previewFile, previewImage]);

	return (
		<section className="rde-imagemap-basic-info">
			<EditorPanelHeader eyebrow="模板" title="基本信息" />
			<div className="rde-imagemap-basic-info-content">
				<Form
					form={form}
					{...INSPECTOR_FORM_PROPS}
					requiredMark
					onValuesChange={(_changedValues, allValues) => {
						onChange({
							shopId: allValues.shopId,
							templateName: allValues.templateName ?? '',
						});
					}}
				>
					<div className="rde-imagemap-basic-info-grid">
						<Form.Item
							label="所属店铺"
							name="shopId"
							rules={[{ required: true, message: '请选择所属店铺' }]}
						>
							<Select
								showSearch
								optionFilterProp="label"
								options={shops}
								placeholder="选择店铺"
							/>
						</Form.Item>
						<Form.Item
							label="模板名称"
							name="templateName"
							rules={[
								{ required: true, message: '请输入模板名称' },
								{ whitespace: true, message: '模板名称不能为空' },
							]}
						>
							<Input placeholder="例如：婚礼签到册" />
						</Form.Item>
					</div>
					{onSave ? (
						<div className="rde-imagemap-template-save-panel">
							<div className="rde-imagemap-template-preview">
								{previewUrl ? <Image src={previewUrl} alt="模板预览图" preview={{ src: previewUrl }} /> : <PictureOutlined />}
							</div>
							<div className="rde-imagemap-template-save-actions">
								<Upload.Dragger
									className="rde-imagemap-template-upload"
									accept=".png,.jpg,.jpeg,.webp"
									beforeUpload={(file) => {
										if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
											setUploadError('仅支持 PNG、JPG、JPEG、WEBP 格式的预览图。');
											return Upload.LIST_IGNORE;
										}
										if (file.size > 10 * 1024 * 1024) {
											setUploadError('预览图不能超过 10MB。');
											return Upload.LIST_IGNORE;
										}
										setUploadError('');
										setPreviewFile(file);
										return false;
									}}
									maxCount={1}
									showUploadList={false}
								>
									<InboxOutlined />
									<span>{previewFile ? previewFile.name : '点击或拖拽上传预览图'}</span>
									<small>支持 PNG、JPG、JPEG、WEBP，最大 10MB</small>
								</Upload.Dragger>
								<Button
									type="primary"
									icon={<SaveOutlined />}
									loading={saving}
									onClick={() => {
										void form.validateFields().then(async () => {
											const saved = await onSave(previewFile);
											if (saved !== false) setPreviewFile(undefined);
										});
									}}
								>
									保存模板
								</Button>
							</div>
							{uploadError ? <div className="rde-imagemap-template-upload-error">{uploadError}</div> : null}
						</div>
					) : null}
				</Form>
			</div>
		</section>
	);
};

export default ImageMapBasicInfo;
