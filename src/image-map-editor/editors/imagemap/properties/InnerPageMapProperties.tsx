import { PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Card, Collapse, Form, Input, InputNumber, Select, Space } from 'antd';
import React from 'react';

import type { CanvasInstance } from '../../../canvas';
import Scrollbar from '../../../components/common/Scrollbar';
import { INSPECTOR_FORM_PROPS, EditorPanelHeader } from '../../../components/editor';
import {
	convertImageMapSizeSchemeUnit,
	type ImageMapSizeSchemeValue,
} from '../ImageMapSizeScheme';
import PropertyDefinition from './PropertyDefinition';

interface InnerPageMapPropertiesProps {
	canvasRef?: CanvasInstance;
	onChange?: (selectedItem: any, changedValues: Record<string, any>, allValues: Record<string, any>) => void;
	selectedItem?: any;
	sizeSchemes: ImageMapSizeSchemeValue[];
	activeSizeSchemeId: string;
	onAddSizeScheme: () => void;
	onSaveSizeScheme: (values: Omit<ImageMapSizeSchemeValue, 'id'>) => void;
	onSelectSizeScheme: (id: string) => void;
}

const InnerPageMapProperties = ({
	canvasRef,
	onChange,
	selectedItem,
	sizeSchemes,
	activeSizeSchemeId,
	onAddSizeScheme,
	onSaveSizeScheme,
	onSelectSizeScheme,
}: InnerPageMapPropertiesProps) => {
	const [form] = Form.useForm();
	const workarea = canvasRef?.handler?.workarea;
	const activeSizeScheme = sizeSchemes.find(item => item.id === activeSizeSchemeId) ?? sizeSchemes[0];
	const unitRef = React.useRef(activeSizeScheme?.unit ?? 'in');

	React.useEffect(() => {
		if (!workarea) {
			form.resetFields();
			return;
		}
		workarea.set('layout', 'fixed');
		unitRef.current = activeSizeScheme?.unit || workarea.unit || 'in';
		form.setFieldsValue({
			sizeSchemeLabel: activeSizeScheme?.label || '',
			layout: 'fixed',
			unit: unitRef.current,
			pageCount: 1,
			pageCountOptions: [1],
			sideWidth: activeSizeScheme?.sideWidth ?? workarea.sideWidth ?? 9,
			sideHeight: activeSizeScheme?.sideHeight ?? workarea.sideHeight ?? 6,
			bleed: 0,
			spineWidthMode: 'fixed',
			spineWidth: 0,
			minSpineWidth: 0,
			maxSpineWidth: 0,
			spineBleed: 0,
			backCoverSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
			coverSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
			spineSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
			paperThickness: 0,
			imageLoadType: workarea.imageLoadType || 'file',
			file: workarea.file,
			src: workarea.src,
		});
	}, [activeSizeScheme, form, workarea]);

	if (!canvasRef) return null;

	const saveSizeScheme = async () => {
		let values: Record<string, any>;
		try {
			values = await form.validateFields(['sizeSchemeLabel', 'unit', 'sideWidth', 'sideHeight']);
		} catch {
			return;
		}
		onSaveSizeScheme({
			label: String(values.sizeSchemeLabel ?? '').trim(),
			unit: values.unit,
			pageCount: 1,
			pageCountOptions: [1],
			sideWidth: Number(values.sideWidth) || 1,
			sideHeight: Number(values.sideHeight) || 1,
			bleed: 0,
			spineWidthMode: 'fixed',
			spineWidth: 0,
			minSpineWidth: 0,
			maxSpineWidth: 0,
			spineBleed: 0,
			backCoverSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
			coverSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
			spineSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
			paperThickness: 0,
		});
	};

	return (
		<Scrollbar>
			<Form
				form={form}
				{...INSPECTOR_FORM_PROPS}
				onValuesChange={(changedValues, allValues) => {
					if (Object.hasOwn(changedValues, 'imageLoadType') || Object.hasOwn(changedValues, 'file') || Object.hasOwn(changedValues, 'src')) {
						onChange?.(selectedItem, changedValues, { workarea: { ...allValues, innerPage: true } });
						return;
					}
					if (Object.hasOwn(changedValues, 'unit')) {
						const nextUnit = changedValues.unit as ImageMapSizeSchemeValue['unit'];
						const convertedValues = convertImageMapSizeSchemeUnit(allValues, unitRef.current, nextUnit);
						unitRef.current = nextUnit;
						form.setFieldsValue(convertedValues);
						canvasRef.handler.workareaHandler.setInnerPageSize(convertedValues);
						onChange?.(selectedItem, { unit: nextUnit }, { workarea: { ...convertedValues, innerPage: true } });
						return;
					}
					if (Object.hasOwn(changedValues, 'sideWidth') || Object.hasOwn(changedValues, 'sideHeight')) {
						canvasRef.handler.workareaHandler.setInnerPageSize(allValues);
						onChange?.(selectedItem, changedValues, { workarea: { ...allValues, innerPage: true } });
					}
				}}
			>
				<EditorPanelHeader eyebrow="规格" title="内页尺寸" description="当前规格的成品宽高" />
				<Collapse
					bordered={false}
					expandIconPosition="end"
					defaultActiveKey={['image']}
					items={[{
						key: 'image',
						label: PropertyDefinition.map.image.title,
						children: PropertyDefinition.map.image.component.render(canvasRef, form, workarea),
					}]}
				/>
				<section className="rde-inner-page-size-section">
					<div className="rde-size-scheme-toolbar">
						<div className="rde-size-scheme-heading"><strong>尺寸方案</strong><span>{sizeSchemes.length} 个成品规格</span></div>
						<Space size={4}>
							<Button type="text" size="small" icon={<PlusOutlined />} onClick={onAddSizeScheme}>新增内页规格</Button>
							<Button type="primary" ghost size="small" icon={<SaveOutlined />} onClick={() => void saveSizeScheme()}>保存内页</Button>
						</Space>
					</div>
					<div className="rde-size-scheme-cards" role="listbox" aria-label="尺寸规格">
						{sizeSchemes.map(item => <Card key={item.id} size="small" hoverable className={`rde-size-scheme-card${item.id === activeSizeScheme?.id ? ' is-active' : ''}`} onClick={() => onSelectSizeScheme(item.id)}><strong>{item.label}</strong></Card>)}
					</div>
					<Form.Item
						className="rde-inner-page-size-name-field"
						label="规格名称"
						name="sizeSchemeLabel"
						rules={[
							{ required: true, message: '请输入规格名称' },
							{ whitespace: true, message: '规格名称不能为空' },
						]}
					>
						<Input placeholder="例如 12*12" />
					</Form.Item>
					<div className="rde-inner-page-size-fields">
						<div className="rde-inner-page-size-fields-heading"><div><strong>宽高</strong><span>{activeSizeScheme?.label || '当前规格'}</span></div></div>
						<Form.Item className="rde-inner-page-unit-field" label="单位" name="unit" rules={[{ required: true, message: '请选择单位' }]}>
							<Select className="rde-inner-page-unit-select" options={[{ value: 'in', label: 'in' }, { value: 'cm', label: 'cm' }, { value: 'mm', label: 'mm' }]} />
						</Form.Item>
						<div className="rde-inner-page-size-fields-grid">
							<Form.Item label="宽" name="sideWidth" rules={[{ required: true, message: '请输入宽' }]}><InputNumber min={0.01} precision={4} style={{ width: '100%' }} /></Form.Item>
							<Form.Item label="高" name="sideHeight" rules={[{ required: true, message: '请输入高' }]}><InputNumber min={0.01} precision={4} style={{ width: '100%' }} /></Form.Item>
						</div>
					</div>
				</section>
			</Form>
		</Scrollbar>
	);
};

export default InnerPageMapProperties;
