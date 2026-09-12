import { Button, Col, Form, Input, InputNumber, List, Row, Select, Space, Tag, Tooltip } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import React from 'react';

import Icon from '../../../components/icon/Icon';

type TextData = {
	fontFamily?: string;
	fontSize?: string | number;
	fontWeight?: string;
	fontStyle?: string;
	linethrough?: boolean;
	underline?: boolean;
	textAlign?: string;
	lineHeight?: number;
	charSpacing?: number;
	wordSpacing?: number;
	fontUrl?: string;
	rules?: string;
	angle?: number;
	horizontalCentered?: boolean;
	verticalCentered?: boolean;
};

type TextPropertyContext = {
	fontOptions?: Array<{ key: string; value: string; label: string; family: string; filePath: string; aliases?: string[] }>;
	fontFamiliesError?: string;
	fontFamiliesLoading?: boolean;
	onFontSearch?: (search: string) => void;
	onFontSelect?: (font: { family: string; filePath: string; aliases?: string[] }) => void | Promise<void | boolean>;
	onCenterHorizontally?: () => void;
	onCenterVertically?: () => void;
	onTextTransform?: (mode: 'capitalize' | 'uppercase') => void;
	textGenerationRules?: Array<{ id: string | number; name: string; description: string }>;
	textGenerationRulesLoading?: boolean;
	onTextGenerationRuleSelect?: (rule: { id: string | number; name: string; description: string }) => void;
};

type FontFamilySearchProps = TextPropertyContext & {
	fontFamily?: string;
	fontUrl?: string;
};

const FontFamilySearch = ({
	fontOptions = [],
	fontFamiliesError,
	fontFamiliesLoading,
	onFontSearch,
	onFontSelect,
	fontFamily,
	fontUrl,
}: FontFamilySearchProps) => {
	const [search, setSearch] = React.useState('');
	const [selectedFilePath, setSelectedFilePath] = React.useState('');
	const skipNextEchoRef = React.useRef(false);
	const searchTimerRef = React.useRef<number | undefined>(undefined);

	React.useEffect(() => {
		setSelectedFilePath(fontUrl?.trim() || '');
	}, [fontUrl]);

	React.useEffect(() => {
		if (skipNextEchoRef.current) {
			skipNextEchoRef.current = false;
			return;
		}
		const nextSearch = fontFamily?.trim() || '';
		if (nextSearch === search) return;
		setSearch(nextSearch);
	}, [fontFamily, fontUrl]);

	React.useEffect(() => () => {
		if (searchTimerRef.current !== undefined) {
			window.clearTimeout(searchTimerRef.current);
		}
	}, []);

	const scheduleSearch = (value: string) => {
		if (searchTimerRef.current !== undefined) {
			window.clearTimeout(searchTimerRef.current);
			searchTimerRef.current = undefined;
		}
		const query = value.trim();
		if (!query) {
			onFontSearch?.('');
			return;
		}
		searchTimerRef.current = window.setTimeout(() => {
			searchTimerRef.current = undefined;
			onFontSearch?.(query);
		}, 350);
	};

	const runSearchImmediately = (value: string) => {
		if (searchTimerRef.current !== undefined) {
			window.clearTimeout(searchTimerRef.current);
			searchTimerRef.current = undefined;
		}
		onFontSearch?.(value.trim());
	};

	return (
		<div className="rde-font-search">
			<Input.Search
				allowClear
				loading={fontFamiliesLoading}
				onChange={event => {
					const value = event.target.value;
					setSearch(value);
					scheduleSearch(value);
				}}
				onSearch={runSearchImmediately}
				placeholder="搜索字体"
				value={search}
			/>
			<div className="rde-font-search-results">
				<List
					dataSource={fontOptions}
					locale={{ emptyText: fontFamiliesError || '暂无字体结果' }}
					renderItem={font => {
						const selected = Boolean(font.filePath && font.filePath === (selectedFilePath || fontUrl));
						return (
							<List.Item key={font.key} className={selected ? 'is-selected' : undefined}>
								<Button
									block
									className={selected ? 'is-selected' : undefined}
									onClick={async () => {
										const applied = await onFontSelect?.(font);
										if (applied === false) return;
										setSelectedFilePath(font.filePath);
										skipNextEchoRef.current = true;
										setSearch(font.label);
									}}
								>
									<Tooltip title={font.label} placement="topLeft">
										<span className="rde-font-search-label">{font.label}</span>
									</Tooltip>
								</Button>
							</List.Item>
						);
					}}
				/>
			</div>
		</div>
	);
};

export default {
	render(_canvasRef: unknown, _form: unknown, data: TextData, context: TextPropertyContext = {}) {
	return (
		<React.Fragment>
			<div className="rde-text-property-rule-group">
				<Form.Item label="规则模板" colon={false}>
					<Select
						allowClear
						showSearch
						optionFilterProp="label"
						placeholder="选择规则模板"
						loading={context.textGenerationRulesLoading}
						value={context.textGenerationRules?.find(rule => rule.description === data.rules)?.id}
						options={(context.textGenerationRules ?? []).map(rule => ({
							value: rule.id,
							label: rule.name || rule.description,
							title: rule.description,
						}))}
						onChange={value => {
							const rule = (context.textGenerationRules ?? []).find(candidate => candidate.id === value);
							if (rule) context.onTextGenerationRuleSelect?.(rule);
						}}
					/>
				</Form.Item>
				<Form.Item label="生成规则" colon={false} name="rules" initialValue={data.rules}>
					<Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
				</Form.Item>
			</div>
			<Form.Item label="字体" colon={false}>
				<FontFamilySearch {...context} fontFamily={data.fontFamily} fontUrl={data.fontUrl} />
			</Form.Item>
			<div className="rde-text-property-third-group">
				<Row gutter={12} className="rde-text-compact-row">
					<Col span={8}>
						<Form.Item label="字号" colon={false} name="fontSize" initialValue={Number(data.fontSize) || 32}>
							<InputNumber controls={false} style={{ width: '100%' }} />
						</Form.Item>
					</Col>
					<Col span={8}>
						<Form.Item label="角度" colon={false} name="angle" initialValue={data.angle} rules={[{ type: 'number', required: true, message: '请输入旋转角度' }]}>
							<InputNumber min={0} max={360} controls={false} style={{ width: '100%' }} />
						</Form.Item>
					</Col>
					<Col span={8}>
						<Form.Item label="行高" colon={false} name="lineHeight" initialValue={data.lineHeight} rules={[{ type: 'number' }]}>
							<InputNumber controls={false} min={0} step={0.01} style={{ width: '100%' }} />
						</Form.Item>
					</Col>
				</Row>
				<div className="rde-text-transform-actions">
					<Button size="small" onClick={() => context.onTextTransform?.('capitalize')}>首字母大写</Button>
					<Button size="small" onClick={() => context.onTextTransform?.('uppercase')}>字母大写</Button>
				</div>
				<Space wrap size={8} className="rde-object-alignment-actions">
					<Button aria-pressed={Boolean(data.horizontalCentered)} icon={data.horizontalCentered ? <CheckOutlined /> : undefined} type={data.horizontalCentered ? 'primary' : 'default'} size="small" onClick={context.onCenterHorizontally}>水平居中</Button>
					<Button aria-pressed={Boolean(data.verticalCentered)} icon={data.verticalCentered ? <CheckOutlined /> : undefined} type={data.verticalCentered ? 'primary' : 'default'} size="small" onClick={context.onCenterVertically}>垂直居中</Button>
				</Space>
				<div className="rde-text-format-actions">
					<Form.Item name="fontWeight" initialValue={data.fontWeight === 'bold'} valuePropName="checked"><Tag.CheckableTag checked={false} className="rde-action-tag"><Icon name="bold" /></Tag.CheckableTag></Form.Item>
					<Form.Item name="fontStyle" initialValue={data.fontStyle === 'italic'} valuePropName="checked"><Tag.CheckableTag checked={false} className="rde-action-tag"><Icon name="italic" /></Tag.CheckableTag></Form.Item>
					<Form.Item name="linethrough" initialValue={data.linethrough} valuePropName="checked"><Tag.CheckableTag checked={false} className="rde-action-tag"><Icon name="strikethrough" /></Tag.CheckableTag></Form.Item>
					<Form.Item name="underline" initialValue={data.underline} valuePropName="checked"><Tag.CheckableTag checked={false} className="rde-action-tag"><Icon name="underline" /></Tag.CheckableTag></Form.Item>
					{(['left', 'center', 'right', 'justify'] as const).map(alignment => (
						<Form.Item key={alignment} name={['textAlign', alignment]} initialValue={data.textAlign === alignment} valuePropName="checked"><Tag.CheckableTag checked={false} className="rde-action-tag"><Icon name={`align-${alignment}`} /></Tag.CheckableTag></Form.Item>
					))}
				</div>
				<Row gutter={12} className="rde-text-compact-row">
					<Col span={12}>
						<Form.Item label="字符间距" colon={false} name="charSpacing" initialValue={data.charSpacing} rules={[{ type: 'number' }]}>
							<InputNumber controls={false} style={{ width: '100%' }} />
						</Form.Item>
					</Col>
					<Col span={12}>
						<Form.Item label="单词间距" colon={false} name="wordSpacing" initialValue={data.wordSpacing ?? 0} rules={[{ type: 'number' }]}>
							<InputNumber controls={false} style={{ width: '100%' }} />
						</Form.Item>
					</Col>
				</Row>
			</div>
		</React.Fragment>
		);
	},
};
