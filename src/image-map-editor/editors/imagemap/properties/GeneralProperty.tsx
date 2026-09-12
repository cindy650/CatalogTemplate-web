import { Button, Col, Form, Input, InputNumber, Row, Space } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import i18next from 'i18next';
import React from 'react';

import type { CanvasInstance } from '../../../canvas';
import { imageMapPixelsPerUnit } from '../ImageMapSizeScheme';

type GeneralPropertyData = {
	type?: string;
	name?: string;
	width: number;
	height: number;
	scaleX: number;
	scaleY: number;
	left?: number;
	top?: number;
	angle?: number;
	horizontalCentered?: boolean;
	verticalCentered?: boolean;
	superType?: string;
};

export type ImageMapTextGenerationRule = {
	id: string | number;
	name: string;
	description: string;
};

type GeneralPropertyContext = {
	onCenterHorizontally?: () => void;
	onCenterVertically?: () => void;
};

export default {
	render(canvasRef: CanvasInstance | undefined, _form: unknown, data: GeneralPropertyData, context: GeneralPropertyContext = {}) {
		const isPhysicalShape = ['rect', 'triangle', 'circle', 'lines', 'dashedrect'].includes(String(data.type || '').toLowerCase());
		const workareaUnit = canvasRef?.handler?.workarea?.unit;
		const unit = workareaUnit === 'cm' || workareaUnit === 'mm' ? workareaUnit : 'in';
		const factor = imageMapPixelsPerUnit[unit];
		const displaySize = (value: number) => Number((value / factor).toFixed(4));
		const width = data.width * data.scaleX;
		const height = data.height * data.scaleY;
		return (
			<React.Fragment>
				<Form.Item label={i18next.t('common.name')} colon={false} name="name" initialValue={data.name}>
					<Input />
				</Form.Item>
				<Row gutter={12} className="rde-object-general-row">
					<Col span={12}>
						<Form.Item
							label={i18next.t('common.width')}
							colon={false}
							name="width"
							initialValue={isPhysicalShape ? displaySize(width) : parseInt(String(width), 10)}
							rules={[{ type: 'number', required: true, message: '请输入宽度', min: isPhysicalShape ? 0.0001 : 1 }]}
						>
							<InputNumber min={isPhysicalShape ? 0.0001 : 1} precision={isPhysicalShape ? 4 : 0} addonAfter={isPhysicalShape ? unit : undefined} />
						</Form.Item>
					</Col>
					<Col span={12}>
						<Form.Item
							label={i18next.t('common.height')}
							colon={false}
							name="height"
							initialValue={isPhysicalShape ? displaySize(height) : parseInt(String(height), 10)}
							rules={[{ type: 'number', required: true, message: '请输入高度', min: isPhysicalShape ? 0.0001 : 1 }]}
						>
							<InputNumber min={isPhysicalShape ? 0.0001 : 1} precision={isPhysicalShape ? 4 : 0} addonAfter={isPhysicalShape ? unit : undefined} />
						</Form.Item>
					</Col>
				</Row>
				<Row gutter={12} className="rde-object-general-row">
					<Col span={12}>
						<Form.Item
							label={i18next.t('common.left')}
							colon={false}
							name="left"
							initialValue={data.left}
							rules={[{ required: true, message: '请输入横向位置' }]}
						>
							<InputNumber />
						</Form.Item>
					</Col>
					<Col span={12}>
						<Form.Item
							label={i18next.t('common.top')}
							colon={false}
							name="top"
							initialValue={data.top}
							rules={[{ required: true, message: '请输入纵向位置' }]}
						>
							<InputNumber />
						</Form.Item>
					</Col>
				</Row>
				{data.type === 'textbox' || data.superType === 'text' ? null : (
					<Space wrap size={8} className="rde-object-alignment-actions">
						<Button aria-pressed={Boolean(data.horizontalCentered)} icon={data.horizontalCentered ? <CheckOutlined /> : undefined} type={data.horizontalCentered ? 'primary' : 'default'} size="small" onClick={context.onCenterHorizontally}>水平居中</Button>
						<Button aria-pressed={Boolean(data.verticalCentered)} icon={data.verticalCentered ? <CheckOutlined /> : undefined} type={data.verticalCentered ? 'primary' : 'default'} size="small" onClick={context.onCenterVertically}>垂直居中</Button>
					</Space>
				)}
				{data.superType === 'element' ? null : data.type === 'textbox' || data.superType === 'text' ? null : (
					<Form.Item
						label={i18next.t('common.angle')}
						colon={false}
						name="angle"
						initialValue={data.angle}
						rules={[{ type: 'number', required: true, message: '请输入旋转角度' }]}
					>
						<InputNumber min={0} max={360} controls={false} style={{ width: '100%' }} />
					</Form.Item>
				)}
			</React.Fragment>
		);
	},
};
