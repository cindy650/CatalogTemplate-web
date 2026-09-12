import { Empty, Form } from 'antd';
import React from 'react';

import type { CanvasInstance } from '../../../canvas';
import Scrollbar from '../../../components/common/Scrollbar';
import { INSPECTOR_FORM_PROPS } from '../../../components/editor';
import { Flex } from '../../../components/flex';
import PropertyDefinition from './PropertyDefinition';
import { imageMapPixelsPerUnit } from '../ImageMapSizeScheme';
import type { ImageMapTextGenerationRule } from './GeneralProperty';

interface NodePropertiesProps {
	canvasRef?: CanvasInstance;
	fontOptions?: Array<{ key: string; value: string; label: string; family: string; filePath: string; aliases?: string[] }>;
	fontFamiliesError?: string;
	fontFamiliesLoading?: boolean;
	onFontSearch?: (search: string) => void;
	onFontSelect?: (font: { family: string; filePath: string; aliases?: string[] }) => void | Promise<void | boolean>;
	onCenterHorizontally?: () => void;
	onCenterVertically?: () => void;
	onTextTransform?: (mode: 'capitalize' | 'uppercase') => void;
	textGenerationRules?: ImageMapTextGenerationRule[];
	textGenerationRulesLoading?: boolean;
	selectedItem?: any;
	objectMeasurementRevision?: number;
	onChange?: (selectedItem: any, changedValues: Record<string, any>, allValues: Record<string, any>) => void;
}

const NodePropertiesForm = (props: NodePropertiesProps) => {
	const { canvasRef, selectedItem, onChange } = props;
	const [form] = Form.useForm();
	const rawType = String(selectedItem?.type || '');
	const propertyType = selectedItem?.superType === 'text'
		? 'textbox'
		: Object.keys(PropertyDefinition).find(key => key.toLowerCase() === rawType.toLowerCase()) || rawType;
	const allPropertySections = selectedItem && PropertyDefinition[propertyType]
		? Object.entries(PropertyDefinition[propertyType])
		: [];
	const textSectionOrder = ['text', 'style', 'general'];
	const propertySections = propertyType === 'textbox'
		? [...allPropertySections].sort(([a], [b]) => {
			const rank = (key: string) => {
				const index = textSectionOrder.indexOf(key);
				return index === -1 ? 999 : index;
			};
			return rank(a) - rank(b);
		})
		: allPropertySections;
	const workareaUnit = canvasRef?.handler?.workarea?.unit;
	React.useEffect(() => {
		const isShape = ['rect', 'triangle', 'circle', 'lines', 'dashedrect'].includes(String(selectedItem?.type || '').toLowerCase());
		const unit = workareaUnit === 'cm' || workareaUnit === 'mm' ? workareaUnit : 'in';
		const factor = imageMapPixelsPerUnit[unit];
		if (isShape) {
			form.setFieldsValue({
				width: Number(((Number(selectedItem.width) * Number(selectedItem.scaleX || 1)) / factor).toFixed(4)),
				height: Number(((Number(selectedItem.height) * Number(selectedItem.scaleY || 1)) / factor).toFixed(4)),
			});
		}
		const isText = selectedItem?.superType === 'text' || selectedItem?.type === 'textbox' || selectedItem?.type === 'i-text';
		if (isText && Number.isFinite(Number(selectedItem.fontSize))) {
			form.setFieldValue('fontSize', Number(selectedItem.fontSize));
		}
	}, [form, props.objectMeasurementRevision, selectedItem, workareaUnit]);
	return (
		<Scrollbar>
			<Form
				form={form}
				{...INSPECTOR_FORM_PROPS}
				onValuesChange={(changedValues, allValues) => {
					onChange?.(selectedItem, changedValues, allValues);
				}}
			>
				{propertySections.length ? (
					<div className="rde-object-property-sections">
						{propertySections.map(([key, section]) => (
							<React.Fragment key={key}>
								{section.component.render(
									canvasRef,
									form,
									selectedItem,
									{
										fontOptions: props.fontOptions,
										fontFamiliesError: props.fontFamiliesError,
										fontFamiliesLoading: props.fontFamiliesLoading,
										onFontSearch: props.onFontSearch,
										onFontSelect: props.onFontSelect,
										onCenterHorizontally: props.onCenterHorizontally,
									onCenterVertically: props.onCenterVertically,
									onTextTransform: props.onTextTransform,
									textGenerationRules: props.textGenerationRules,
									textGenerationRulesLoading: props.textGenerationRulesLoading,
									onTextGenerationRuleSelect: (rule: ImageMapTextGenerationRule) => {
										form.setFieldValue('rules', rule.description);
										onChange?.(selectedItem, { rules: rule.description }, { ...form.getFieldsValue(), rules: rule.description });
									},
								},
								)}
							</React.Fragment>
						))}
					</div>
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
