import React from 'react';
import { Col, Form, Radio, Row, Switch } from 'antd';

import FileUpload from '../../../components/common/FileUpload';
import UrlModal from '../../../components/common/UrlModal';

type VideoData = {
	autoplay?: boolean;
	muted?: boolean;
	loop?: boolean;
	videoLoadType?: 'file' | 'src';
	file?: File | null;
	src?: string;
};

export default {
	render(_canvasRef: unknown, form: any, data?: VideoData) {
		if (!data) {
			return null;
		}

		const videoLoadType = Form.useWatch('videoLoadType', form) || data.videoLoadType || 'file';

		return (
			<React.Fragment>
				<Row>
					<Col span={8}>
						<Form.Item
							label="自动播放"
							colon={false}
							name="autoplay"
							initialValue={data.autoplay}
							rules={[{ type: 'boolean' }]}
							valuePropName="checked"
						>
							<Switch />
						</Form.Item>
					</Col>
					<Col span={8}>
						<Form.Item
							label="静音"
							colon={false}
							name="muted"
							initialValue={data.muted}
							rules={[{ type: 'boolean' }]}
							valuePropName="checked"
						>
							<Switch />
						</Form.Item>
					</Col>
					<Col span={8}>
						<Form.Item
							label="循环"
							colon={false}
							name="loop"
							initialValue={data.loop}
							rules={[{ type: 'boolean' }]}
							valuePropName="checked"
						>
							<Switch />
						</Form.Item>
					</Col>
				</Row>
				<Form.Item label="视频加载方式" colon={false} name="videoLoadType" initialValue={videoLoadType}>
					<Radio.Group size="large">
						<Radio.Button value="file">上传文件</Radio.Button>
						<Radio.Button value="src">视频地址</Radio.Button>
					</Radio.Group>
				</Form.Item>
				{videoLoadType === 'file' ? (
					<Form.Item
						label="文件"
						colon={false}
						name="file"
						initialValue={data.file}
						rules={[{ required: true, message: '请选择视频' }]}
					>
						<FileUpload accept="video/*" />
					</Form.Item>
				) : (
					<Form.Item name="src" initialValue={data.src} rules={[{ required: true, message: '请选择视频地址' }]}>
						<UrlModal />
					</Form.Item>
				)}
			</React.Fragment>
		);
	},
};
