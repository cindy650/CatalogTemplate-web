import { Col, Form, Input, InputNumber, Row, Slider, Switch } from 'antd';
import i18next from 'i18next';
import React from 'react';

type GeneralPropertyData = {
	type?: string;
	locked?: boolean;
	visible?: boolean;
	name?: string;
	rules?: string;
	width: number;
	height: number;
	scaleX: number;
	scaleY: number;
	left?: number;
	top?: number;
	angle?: number;
	superType?: string;
};

export default {
	render(_canvasRef: unknown, _form: unknown, data: GeneralPropertyData) {
		return (
			<React.Fragment>
				<Row>
					<Col span={12}>
						<Form.Item
							label={i18next.t('common.locked')}
							colon={false}
							name="locked"
							initialValue={data.locked}
							rules={[{ type: 'boolean' }]}
							valuePropName="checked"
						>
							<Switch size="small" />
						</Form.Item>
					</Col>
					<Col span={12}>
						<Form.Item
							label={i18next.t('common.visible')}
							colon={false}
							name="visible"
							initialValue={data.visible}
							rules={[{ type: 'boolean' }]}
							valuePropName="checked"
						>
							<Switch size="small" />
						</Form.Item>
					</Col>
				</Row>
				<Form.Item label={i18next.t('common.name')} colon={false} name="name" initialValue={data.name}>
					<Input />
				</Form.Item>
				{data.type === 'textbox' || data.superType === 'text' ? (
					<Form.Item label="生成规则" colon={false} name="rules" initialValue={data.rules}>
						<Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
					</Form.Item>
				) : null}
				<Row>
					<Col span={12}>
						<Form.Item
							label={i18next.t('common.width')}
							colon={false}
							name="width"
							initialValue={parseInt(String(data.width * data.scaleX), 10)}
							rules={[{ type: 'number', required: true, message: '请输入宽度', min: 1 }]}
						>
							<InputNumber min={1} />
						</Form.Item>
					</Col>
					<Col span={12}>
						<Form.Item
							label={i18next.t('common.height')}
							colon={false}
							name="height"
							initialValue={parseInt(String(data.height * data.scaleY), 10)}
							rules={[{ type: 'number', required: true, message: '请输入高度', min: 1 }]}
						>
							<InputNumber min={1} />
						</Form.Item>
					</Col>
				</Row>
				<Row>
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
				{data.superType === 'element' ? null : data.type === 'textbox' || data.superType === 'text' ? (
					<Form.Item
						label={i18next.t('common.angle')}
						colon={false}
						name="angle"
						initialValue={data.angle}
						rules={[{ type: 'number', required: true, message: '请输入旋转角度' }]}
					>
						<InputNumber min={0} max={360} controls={false} style={{ width: '100%' }} />
					</Form.Item>
				) : (
					<Form.Item
						label={i18next.t('common.angle')}
						colon={false}
						name="angle"
						initialValue={data.angle}
						rules={[{ type: 'number', required: true, message: '请输入旋转角度' }]}
					>
						<Slider min={0} max={360} />
					</Form.Item>
				)}
			</React.Fragment>
		);
	},
};
