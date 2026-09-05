import { Col, Form, InputNumber, Row } from 'antd';
import React from 'react';

import ColorPicker from '../../../components/common/ColorPicker';

type LinesData = {
	lineThickness?: number;
	lineSpacing?: number;
	lineColor?: string;
	lineCount?: number;
};

export default {
	render(_canvasRef: unknown, _form: unknown, data: LinesData) {
		return (
			<React.Fragment>
				<Row gutter={12} className="rde-object-general-row">
					<Col span={12}>
						<Form.Item label="线条粗细" colon={false} name="lineThickness" initialValue={data.lineThickness ?? 0.7}>
							<InputNumber min={0.1} max={100} precision={2} style={{ width: '100%' }} />
						</Form.Item>
					</Col>
					<Col span={12}>
						<Form.Item label="线条间距" colon={false} name="lineSpacing" initialValue={data.lineSpacing ?? 12}>
							<InputNumber min={0} max={1000} precision={2} style={{ width: '100%' }} />
						</Form.Item>
					</Col>
				</Row>
				<Row gutter={12} className="rde-object-general-row">
					<Col span={12}>
						<Form.Item label="线条颜色" colon={false} name="lineColor" initialValue={data.lineColor || '#7f7f7f'}>
							<ColorPicker />
						</Form.Item>
					</Col>
					<Col span={12}>
						<Form.Item label="线条数量" colon={false} name="lineCount" initialValue={data.lineCount ?? 3}>
							<InputNumber min={1} max={100} precision={0} style={{ width: '100%' }} />
						</Form.Item>
					</Col>
				</Row>
			</React.Fragment>
		);
	},
};
