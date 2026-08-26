import { Collapse, Empty, Form } from 'antd';
import React from 'react';

import type { CanvasInstance } from '../../../canvas';
import Scrollbar from '../../../components/common/Scrollbar';
import { INSPECTOR_FORM_PROPS } from '../../../components/editor';
import { Flex } from '../../../components/flex';
import PropertyDefinition from './PropertyDefinition';

interface NodePropertiesProps {
	canvasRef?: CanvasInstance;
	fontOptions?: Array<{ key: string; value: string; label: string; family: string; filePath: string }>;
	fontFamiliesError?: string;
	fontFamiliesLoading?: boolean;
	onFontSearch?: (search: string) => void;
	onFontSelect?: (font: { family: string; filePath: string }) => void;
	selectedItem?: any;
	onChange?: (selectedItem: any, changedValues: Record<string, any>, allValues: Record<string, any>) => void;
}

const NodePropertiesForm = (props: NodePropertiesProps) => {
	const { canvasRef, selectedItem, onChange } = props;
	const [form] = Form.useForm();
	const propertyType = selectedItem?.superType === 'text' ? 'textbox' : selectedItem?.type;
	return (
		<Scrollbar>
			<Form
				form={form}
				{...INSPECTOR_FORM_PROPS}
				onValuesChange={(changedValues, allValues) => {
					onChange?.(selectedItem, changedValues, allValues);
				}}
			>
				{selectedItem && PropertyDefinition[propertyType] ? (
					<Collapse
						bordered={false}
						expandIconPosition="end"
						items={Object.keys(PropertyDefinition[propertyType]).map(key => ({
							key,
							label: PropertyDefinition[propertyType][key].title,
							showArrow: true,
							children: PropertyDefinition[propertyType][key].component.render(
								canvasRef,
								form,
								selectedItem,
								{
									fontOptions: props.fontOptions,
									fontFamiliesError: props.fontFamiliesError,
									fontFamiliesLoading: props.fontFamiliesLoading,
									onFontSearch: props.onFontSearch,
									onFontSelect: props.onFontSelect,
								},
							),
						}))}
					/>
				) : (
					<Flex
						justifyContent="center"
						alignItems="center"
						style={{
							width: '100%',
							height: '100%',
							color: 'rgba(0, 0, 0, 0.45)',
							fontSize: 16,
							padding: 16,
						}}
					>
						<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
					</Flex>
				)}
			</Form>
		</Scrollbar>
	);
};

export default function NodeProperties(props: NodePropertiesProps) {
	return <NodePropertiesForm key={props.selectedItem?.id || 'empty'} {...props} />;
}
