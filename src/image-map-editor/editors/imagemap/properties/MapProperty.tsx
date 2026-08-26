import { Form, Input, Select } from 'antd';
import i18next from 'i18next';
import React from 'react';

const MapPropertyFields = ({ data }: { form: any; data: any }) => {
	if (!data) {
		return null;
	}

	return (
		<React.Fragment>
			<Form.Item name="layout" hidden>
				<Input />
			</Form.Item>
			<Form.Item label={i18next.t('common.layout')} colon={false}>
				<Select disabled value="fixed" options={[{ value: 'fixed', label: i18next.t('common.fixed') }]} />
			</Form.Item>
		</React.Fragment>
	);
};

export default {
	render(_canvasRef: unknown, form: any, data: any) {
		return <MapPropertyFields form={form} data={data} />;
	},
};
