import { Button, Col, Form, Input, InputNumber, List, Tag, Tooltip } from 'antd';
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
};

type TextPropertyContext = {
	fontOptions?: Array<{ key: string; value: string; label: string; family: string; filePath: string }>;
	fontFamiliesError?: string;
	fontFamiliesLoading?: boolean;
	onFontSearch?: (search: string) => void;
	onFontSelect?: (font: { family: string; filePath: string }) => void;
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
	const skipNextSearchRef = React.useRef(false);
	const skipNextEchoRef = React.useRef(false);

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
		skipNextSearchRef.current = true;
		setSearch(nextSearch);
	}, [fontFamily, fontUrl]);

	React.useEffect(() => {
		if (skipNextSearchRef.current) {
			skipNextSearchRef.current = false;
			return;
		}
		const query = search.trim();
		if (!query) return;
		const timer = window.setTimeout(() => onFontSearch?.(query), 350);
		return () => window.clearTimeout(timer);
	}, [onFontSearch, search]);

	return (
		<div className="rde-font-search">
			<Input.Search
				allowClear
				loading={fontFamiliesLoading}
				onChange={event => setSearch(event.target.value)}
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
									onClick={() => {
										setSelectedFilePath(font.filePath);
										skipNextEchoRef.current = true;
										onFontSelect?.(font);
										skipNextSearchRef.current = true;
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
				<Col span={24}>
					<Form.Item label="字体" colon={false}>
						<FontFamilySearch {...context} fontFamily={data.fontFamily} fontUrl={data.fontUrl} />
					</Form.Item>
				</Col>
				<Col span={8}>
					<Form.Item
						label="字号"
						colon={false}
						name="fontSize"
						initialValue={Number(data.fontSize) || 32}
					>
						<InputNumber controls={false} style={{ width: '100%' }} />
					</Form.Item>
				</Col>
				<Col span={24}>
					<div className="rde-text-format-actions">
						<Form.Item name="fontWeight" initialValue={data.fontWeight === 'bold'} valuePropName="checked">
							<Tag.CheckableTag checked={false} className="rde-action-tag"><Icon name="bold" /></Tag.CheckableTag>
						</Form.Item>
						<Form.Item name="fontStyle" initialValue={data.fontStyle === 'italic'} valuePropName="checked">
							<Tag.CheckableTag checked={false} className="rde-action-tag"><Icon name="italic" /></Tag.CheckableTag>
						</Form.Item>
						<Form.Item name="linethrough" initialValue={data.linethrough} valuePropName="checked">
							<Tag.CheckableTag checked={false} className="rde-action-tag"><Icon name="strikethrough" /></Tag.CheckableTag>
						</Form.Item>
						<Form.Item name="underline" initialValue={data.underline} valuePropName="checked">
							<Tag.CheckableTag checked={false} className="rde-action-tag"><Icon name="underline" /></Tag.CheckableTag>
						</Form.Item>
						{(['left', 'center', 'right', 'justify'] as const).map(alignment => (
							<Form.Item key={alignment} name={['textAlign', alignment]} initialValue={data.textAlign === alignment} valuePropName="checked">
								<Tag.CheckableTag checked={false} className="rde-action-tag"><Icon name={`align-${alignment}`} /></Tag.CheckableTag>
							</Form.Item>
						))}
					</div>
				</Col>
				<Col span={8}>
					<Form.Item
						label="行高"
						colon={false}
						name="lineHeight"
						initialValue={data.lineHeight}
						rules={[{ type: 'number' }]}
					>
						<InputNumber controls={false} min={0} step={0.01} style={{ width: '100%' }} />
					</Form.Item>
				</Col>
				<Col span={8}>
					<Form.Item
						label="字符间距"
						colon={false}
						name="charSpacing"
						initialValue={data.charSpacing}
						rules={[{ type: 'number' }]}
					>
						<InputNumber controls={false} style={{ width: '100%' }} />
					</Form.Item>
				</Col>
				<Col span={8}>
					<Form.Item
						label="单词间距"
						colon={false}
						name="wordSpacing"
						initialValue={data.wordSpacing ?? 0}
						rules={[{ type: 'number' }]}
					>
						<InputNumber controls={false} style={{ width: '100%' }} />
					</Form.Item>
				</Col>
			</React.Fragment>
		);
	},
};
