import React from 'react';
import { Button, Col, Form, InputNumber, Row, Select, Slider, Switch } from 'antd';

import ColorPicker from '../../../components/common/ColorPicker';

type DataSourceAnimationValue = {
	type?: string;
	autoplay?: boolean;
	loop?: boolean;
	delay?: number;
	duration?: number;
	opacity?: number;
	bounce?: string;
	offset?: number;
	shake?: string;
	scale?: number;
	angle?: number;
	fill?: string;
	stroke?: string;
	value?: number;
};

type DataSourceData = {
	id?: string;
	angle?: number;
	fill?: string;
	stroke?: string;
	animation: DataSourceAnimationValue;
};

const renderDataSourceFields = (type: string, data: DataSourceData) => {
	if (type === 'fade') {
		return (
			<Form.Item
				label="不透明度"
				colon={false}
				name={['animation', 'opacity']}
				initialValue={data.animation.opacity || 0}
				rules={[{ type: 'number', min: 0, max: 1 }]}
			>
				<Slider min={0} max={1} step={0.1} />
			</Form.Item>
		);
	}
	if (type === 'bounce') {
		return (
			<React.Fragment>
				<Form.Item
					label="弹跳方向"
					colon={false}
					name={['animation', 'bounce']}
					initialValue={data.animation.bounce || 'hotizontal'}
				>
					<Select>
						<Select.Option value="hotizontal">水平</Select.Option>
						<Select.Option value="vertical">垂直</Select.Option>
					</Select>
				</Form.Item>
				<Form.Item
					label="偏移"
					colon={false}
					name={['animation', 'offset']}
					initialValue={data.animation.offset || 1}
					rules={[{ type: 'number', min: 1, max: 10 }]}
				>
					<Slider min={1} max={10} step={1} />
				</Form.Item>
			</React.Fragment>
		);
	}
	if (type === 'shake') {
		return (
			<React.Fragment>
				<Form.Item
					label="摇晃方向"
					colon={false}
					name={['animation', 'shake']}
					initialValue={data.animation.shake || 'hotizontal'}
				>
					<Select>
						<Select.Option value="hotizontal">水平</Select.Option>
						<Select.Option value="vertical">垂直</Select.Option>
					</Select>
				</Form.Item>
				<Form.Item
					label="偏移"
					colon={false}
					name={['animation', 'offset']}
					initialValue={data.animation.offset || 1}
					rules={[{ type: 'number', min: 1, max: 10 }]}
				>
					<Slider min={1} max={10} step={1} />
				</Form.Item>
			</React.Fragment>
		);
	}
	if (type === 'scaling') {
		return (
			<Form.Item
				label="缩放"
				colon={false}
				name={['animation', 'scale']}
				initialValue={data.animation.scale || 1}
				rules={[{ type: 'number', min: 1, max: 5 }]}
			>
				<Slider min={1} max={5} step={0.1} />
			</Form.Item>
		);
	}
	if (type === 'rotation') {
		return (
			<Form.Item
				label="角度"
				colon={false}
				name={['animation', 'angle']}
				initialValue={data.animation.angle || data.angle}
				rules={[{ type: 'number', min: 0, max: 360 }]}
			>
				<Slider min={0} max={360} />
			</Form.Item>
		);
	}
	if (type === 'flash') {
		return (
			<Row>
				<Col span={12}>
					<Form.Item
						label="填充颜色"
						colon={false}
						name={['animation', 'fill']}
						initialValue={data.animation.fill || data.fill}
					>
						<ColorPicker />
					</Form.Item>
				</Col>
				<Col span={12}>
					<Form.Item
						label="描边颜色"
						colon={false}
						name={['animation', 'stroke']}
						initialValue={data.animation.stroke || data.stroke}
					>
						<ColorPicker />
					</Form.Item>
				</Col>
			</Row>
		);
	}
	return (
		<Row>
			<Col span={12}>
				<Form.Item
					label="值"
					colon={false}
					name={['animation', 'value']}
					initialValue={data.animation.value || 1}
					rules={[{ type: 'number', min: 1, max: 10 }]}
				>
					<InputNumber min={1} max={10} />
				</Form.Item>
			</Col>
		</Row>
	);
};

export default {
	render(canvasRef: any, form: any, data?: DataSourceData) {
		if (!data) {
			return null;
		}
		const type = Form.useWatch(['animation', 'type'], form) || data.animation.type || 'none';
		return (
			<React.Fragment>
				<Form.Item label="动画类型" colon={false} name={['animation', 'type']} initialValue={type}>
					<Select>
						<Select.Option value="none">无</Select.Option>
						<Select.Option value="fade">淡入淡出</Select.Option>
						<Select.Option value="bounce">弹跳</Select.Option>
						<Select.Option value="shake">摇晃</Select.Option>
						<Select.Option value="scaling">缩放</Select.Option>
						<Select.Option value="rotation">旋转</Select.Option>
						<Select.Option value="flash">闪烁</Select.Option>
					</Select>
				</Form.Item>
				{type === 'none' ? null : (
					<React.Fragment>
						<Row>
							<Col span={12}>
								<Form.Item
									label="自动播放"
									colon={false}
									name={['animation', 'autoplay']}
									initialValue={data.animation.autoplay || false}
									valuePropName="checked"
									rules={[{ type: 'boolean' }]}
								>
									<Switch size="small" />
								</Form.Item>
							</Col>
							<Col span={12}>
								<Form.Item
									label="循环"
									colon={false}
									name={['animation', 'loop']}
									initialValue={data.animation.loop || false}
									valuePropName="checked"
									rules={[{ type: 'boolean' }]}
								>
									<Switch size="small" />
								</Form.Item>
							</Col>
						</Row>
						{type !== 'shake' ? (
							<Row>
								<Col span={12}>
									<Form.Item
										label="延迟"
										colon={false}
										name={['animation', 'delay']}
										initialValue={data.animation.delay || 100}
										rules={[{ type: 'number', min: 100, max: 5000 }]}
									>
										<Slider min={100} max={5000} step={100} />
									</Form.Item>
								</Col>
								<Col span={12}>
									<Form.Item
										label="持续时间"
										colon={false}
										name={['animation', 'duration']}
										initialValue={data.animation.duration || 1000}
										rules={[{ type: 'number', min: 100, max: 5000 }]}
									>
										<Slider min={100} max={5000} step={100} />
									</Form.Item>
								</Col>
							</Row>
						) : null}
						{renderDataSourceFields(type, data)}
						<Form.Item label="播放控制" colon={false}>
							<Row>
								<Col span={8}>
									<Button onClick={() => canvasRef.handler.animationHandler.play(data.id)}>
										开始
									</Button>
								</Col>
								<Col span={8}>
									<Button onClick={() => canvasRef.handler.animationHandler.pause(data.id)}>
										暂停
									</Button>
								</Col>
								<Col span={8}>
									<Button onClick={() => canvasRef.handler.animationHandler.stop(data.id)}>
										停止
									</Button>
								</Col>
							</Row>
						</Form.Item>
					</React.Fragment>
				)}
			</React.Fragment>
		);
	},
};
