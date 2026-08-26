import React from 'react';
import { Col, Form, Input, InputNumber, Row, Slider } from 'antd';

type GroupData = {
	name?: string;
	width: number;
	height: number;
	scaleX: number;
	scaleY: number;
	left?: number;
	top?: number;
	angle?: number;
};

export default {
	render(_canvasRef: unknown, _form: unknown, data: GroupData) {
		return (
			<React.Fragment>
				<Form.Item label="名称" colon={false} name="name" initialValue={data.name}>
					<Input />
				</Form.Item>
				<Row>
					<Col span={12}>
						<Form.Item
							label="宽度"
							colon={false}
							name="width"
							initialValue={data.width * data.scaleX}
							rules={[{ required: true, message: '请输入宽度' }]}
						>
							<InputNumber />
						</Form.Item>
					</Col>
					<Col span={12}>
						<Form.Item
							label="高度"
							colon={false}
							name="height"
							initialValue={data.height * data.scaleY}
							rules={[{ required: true, message: '请输入高度' }]}
						>
							<InputNumber />
						</Form.Item>
					</Col>
				</Row>
				<Row>
					<Col span={12}>
						<Form.Item
							label="左侧位置"
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
							label="顶部位置"
							colon={false}
							name="top"
							initialValue={data.top}
							rules={[{ required: true, message: '请输入纵向位置' }]}
						>
							<InputNumber />
						</Form.Item>
					</Col>
				</Row>
				<Form.Item
					label="旋转"
					colon={false}
					name="angle"
					initialValue={data.angle}
						rules={[{ type: 'number', required: true, message: '请输入旋转角度' }]}
				>
					<Slider min={0} max={360} />
				</Form.Item>
			</React.Fragment>
		);
	},
};
