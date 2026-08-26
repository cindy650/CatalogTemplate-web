import React from 'react';
import { Form } from 'antd';

import ChartModal from '../../../components/common/ChartModal';

type ChartData = {
	chartOptionStr?: string;
};

export default {
	render(_canvasRef: unknown, _form: unknown, data?: ChartData) {
		if (!data) {
			return null;
		}

		return (
			<Form.Item
				name="chartOption"
				initialValue={data.chartOptionStr}
				rules={[{ required: true, message: '请输入代码' }]}
			>
				<ChartModal />
			</Form.Item>
		);
	},
};
