import { Col, Form, InputNumber, Row, Switch } from 'antd';
import React from 'react';

import ColorPicker from '../../../components/common/ColorPicker';

type DashedRectData = {
	lineColor?: string;
	dashed?: boolean;
	cornerRadius?: number;
	lineThickness?: number;
	dashDensity?: number;
};

export default {
	render(_canvasRef: unknown, _form: unknown, data: DashedRectData) {
		return (
			<React.Fragment>
				<Row gutter={12} className="rde-object-general-row">
					<Col span={12}>
						<Form.Item label="线条颜色" colon={false} name="lineColor" initialValue={data.lineColor || '#7f7f7f'}>
							<ColorPicker />
						</Form.Item>
					</Col>
					<Col span={12}>
						<Form.Item label="虚线" colon={false} name="dashed" initialValue={data.dashed !== false} valuePropName="checked">
							<Switch size="small" />
						</Form.Item>
					</Col>
				</Row>
				<Form.Item label="线段粗细" colon={false} name="lineThickness" initialValue={data.lineThickness ?? 1}>
					<InputNumber min={0.1} max={20} precision={2} style={{ width: '100%' }} />
				</Form.Item>
				<Form.Item label="线段密度" colon={false} name="dashDensity" initialValue={data.dashDensity ?? 8}>
					<InputNumber min={1} max={100} precision={0} style={{ width: '100%' }} />
				</Form.Item>
				<Form.Item label="圆角" colon={false} name="cornerRadius" initialValue={data.cornerRadius ?? 0}>
					<InputNumber min={0} max={1000} precision={2} style={{ width: '100%' }} />
				</Form.Item>
			</React.Fragment>
		);
	},
};
