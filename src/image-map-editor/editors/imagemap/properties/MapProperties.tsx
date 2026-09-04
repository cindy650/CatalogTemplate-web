import { CloseOutlined, DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import {
	Button,
	Card,
	Col,
	Collapse,
	Form,
	Input,
	InputNumber,
	Popconfirm,
	Row,
	Segmented,
	Select,
	Space,
	Tooltip,
} from 'antd';
import React from 'react';

import type { CanvasInstance } from '../../../canvas';
import Scrollbar from '../../../components/common/Scrollbar';
import { INSPECTOR_FORM_PROPS } from '../../../components/editor';
import {
	convertImageMapSizeSchemeUnit,
	resolveImageMapSpineWidth,
	type ImageMapSizeSchemeValue,
} from '../ImageMapSizeScheme';
import PropertyDefinition from './PropertyDefinition';

interface PageCountOptionsEditorProps {
	value?: number[];
	selected?: number;
	onChange?: (value: number[]) => void;
	onSelect: (value: number) => void;
}

const PageCountOptionsEditor = ({
	value = [],
	selected,
	onChange,
	onSelect,
}: PageCountOptionsEditorProps) => {
	const [adding, setAdding] = React.useState(false);
	const [draft, setDraft] = React.useState<number | null>(null);
	const options = value.length ? value : [50, 100];

	const commit = () => {
		const pageCount = Math.round(Number(draft));
		if (!Number.isFinite(pageCount) || pageCount <= 0) {
			setAdding(false);
			setDraft(null);
			return;
		}
		const next = Array.from(new Set([...options, pageCount])).sort((left, right) => left - right);
		onChange?.(next);
		onSelect(pageCount);
		setAdding(false);
		setDraft(null);
	};

	return (
		<div className="rde-page-count-options" role="listbox" aria-label="页数选项">
			{options.map(pageCount => (
				<div className={`rde-page-count-option${selected === pageCount ? ' is-active' : ''}`} key={pageCount}>
					<Button
						type={selected === pageCount ? 'primary' : 'default'}
						size="small"
						role="option"
						aria-selected={selected === pageCount}
						onClick={() => onSelect(pageCount)}
					>
						{pageCount}
					</Button>
					<Tooltip title={options.length <= 1 ? '至少保留一个页数选项' : `删除 ${pageCount} 页`}>
						<Button
							type="text"
							danger
							size="small"
							icon={<CloseOutlined />}
							disabled={options.length <= 1}
							aria-label={`删除 ${pageCount} 页`}
							onClick={() => {
								const next = options.filter(item => item !== pageCount);
								onChange?.(next);
								if (selected === pageCount) {
									onSelect(next[0]);
								}
							}}
						/>
					</Tooltip>
				</div>
			))}
			{adding ? (
				<InputNumber
					autoFocus
					className="rde-page-count-input"
					size="small"
					min={1}
					precision={0}
					controls={false}
					placeholder="页数"
					value={draft}
					onChange={setDraft}
					onPressEnter={commit}
					onBlur={commit}
				/>
			) : (
				<Button
					type="dashed"
					size="small"
					className="rde-page-count-add"
					icon={<PlusOutlined />}
					onClick={() => setAdding(true)}
				>
					添加页数
				</Button>
			)}
		</div>
	);
};

interface MapPropertiesProps {
	canvasRef?: CanvasInstance;
	onChange?: (selectedItem: any, changedValues: Record<string, any>, allValues: Record<string, any>) => void;
	selectedItem?: any;
	sizeSchemes: ImageMapSizeSchemeValue[];
	activeSizeSchemeId: string;
	onAddSizeScheme: () => void;
	onDeleteSizeScheme: (id: string) => void;
	onSaveSizeScheme: (values: Omit<ImageMapSizeSchemeValue, 'id'>) => void;
	onSelectSizeScheme: (id: string) => void;
}

const MapProperties = ({
	canvasRef,
	onChange,
	selectedItem,
	sizeSchemes,
	activeSizeSchemeId,
	onAddSizeScheme,
	onDeleteSizeScheme,
	onSaveSizeScheme,
	onSelectSizeScheme,
}: MapPropertiesProps) => {
	const [form] = Form.useForm();
	const workarea = canvasRef?.handler?.workarea;
	const activeSizeScheme = sizeSchemes.find(item => item.id === activeSizeSchemeId) ?? sizeSchemes[0];
	const selectedPageCount = Form.useWatch('pageCount', form);
	const selectedSpineWidthMode = Form.useWatch('spineWidthMode', form);
	const usesSeparateBleed = activeSizeScheme?.separateBleed === true;
	const unitRef = React.useRef(activeSizeScheme?.unit ?? 'in');

	const workareaValues = React.useCallback((values: Record<string, any>) => {
		const printValues: Record<string, any> = {
			...values,
			separateBleed: usesSeparateBleed,
			bleed: usesSeparateBleed ? values.horizontalBleed : values.bleed,
		};
		delete printValues.backCoverSafeDistance;
		delete printValues.coverSafeDistance;
		delete printValues.spineSafeDistance;
		return {
			...printValues,
			spineWidth: resolveImageMapSpineWidth(printValues),
		};
	}, [usesSeparateBleed]);

	const emitWorkareaChange = React.useCallback((
		changedValues: Record<string, any>,
		values: Record<string, any>,
	) => {
		const nextWorkareaValues = workareaValues(values);
		const spineCalculationKeys = [
			'pageCount',
			'spineWidthMode',
			'minSpineWidth',
			'maxSpineWidth',
			'paperThickness',
		];
		const shouldRecalculateSpine = Object.keys(changedValues).some(key => spineCalculationKeys.includes(key));
		onChange?.(
			selectedItem,
			shouldRecalculateSpine ? { spineWidth: nextWorkareaValues.spineWidth } : changedValues,
			{ workarea: nextWorkareaValues },
		);
	}, [onChange, selectedItem, workareaValues]);

	const selectPageCount = React.useCallback((pageCount: number) => {
		form.setFieldValue('pageCount', pageCount);
		emitWorkareaChange({ pageCount }, { ...form.getFieldsValue(true), pageCount });
	}, [emitWorkareaChange, form]);

	React.useEffect(() => {
		if (!workarea) {
			form.resetFields();
			return;
		}
		workarea.set('layout', 'fixed');
		unitRef.current = activeSizeScheme?.unit || workarea.unit || 'in';

		form.setFieldsValue({
			sizeSchemeLabel: activeSizeScheme?.label || '',
			layout: 'fixed',
			unit: unitRef.current,
			pageCount: activeSizeScheme?.pageCount ?? 50,
			pageCountOptions: activeSizeScheme?.pageCountOptions ?? [50, 100],
			sideWidth: activeSizeScheme?.sideWidth ?? workarea.sideWidth ?? 9,
			sideHeight: activeSizeScheme?.sideHeight ?? workarea.sideHeight ?? 6,
			bleed: activeSizeScheme?.bleed ?? workarea.bleed ?? 0.79,
			separateBleed: usesSeparateBleed,
			horizontalBleed: activeSizeScheme?.horizontalBleed ?? workarea.horizontalBleed ?? activeSizeScheme?.bleed ?? workarea.bleed ?? 0.79,
			verticalBleed: activeSizeScheme?.verticalBleed ?? workarea.verticalBleed ?? activeSizeScheme?.bleed ?? workarea.bleed ?? 0.79,
			spineWidthMode: activeSizeScheme?.spineWidthMode ?? 'fixed',
			spineWidth: activeSizeScheme?.spineWidth ?? workarea.spineWidth ?? 0.55,
			minSpineWidth: activeSizeScheme?.minSpineWidth ?? 0.55,
			maxSpineWidth: activeSizeScheme?.maxSpineWidth ?? 0.7,
			spineBleed: activeSizeScheme?.spineBleed ?? workarea.spineBleed ?? 0.55,
			backCoverSafeDistance: activeSizeScheme?.backCoverSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
			coverSafeDistance: activeSizeScheme?.coverSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
			spineSafeDistance: activeSizeScheme?.spineSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
			paperThickness: activeSizeScheme?.paperThickness ?? 0,
			imageLoadType: workarea.imageLoadType || 'file',
			file: workarea.file,
			src: workarea.src,
		});
	}, [activeSizeScheme, form, usesSeparateBleed, workarea]);

	if (!canvasRef) {
		return null;
	}

	return (
		<Scrollbar>
			<Form
				form={form}
				{...INSPECTOR_FORM_PROPS}
				requiredMark
				onValuesChange={(changedValues, allValues) => {
					if (
						Object.hasOwn(changedValues, 'sizeSchemeLabel')
						|| Object.hasOwn(changedValues, 'pageCountOptions')
						|| Object.hasOwn(changedValues, 'backCoverSafeDistance')
						|| Object.hasOwn(changedValues, 'coverSafeDistance')
						|| Object.hasOwn(changedValues, 'spineSafeDistance')
					) {
						return;
					}
					if (Object.hasOwn(changedValues, 'unit')) {
						const nextUnit = changedValues.unit as ImageMapSizeSchemeValue['unit'];
						const convertedValues = convertImageMapSizeSchemeUnit(
							allValues,
							unitRef.current,
							nextUnit,
						);
						unitRef.current = nextUnit;
						form.setFieldsValue(convertedValues);
						emitWorkareaChange({ unit: nextUnit }, convertedValues);
						return;
					}
					emitWorkareaChange(changedValues, allValues);
				}}
			>
				<Collapse
					bordered={false}
					expandIconPosition="end"
					defaultActiveKey={[]}
					items={Object.keys(PropertyDefinition.map).map(key => ({
						key,
						label: PropertyDefinition.map[key].title,
						showArrow: true,
						children: PropertyDefinition.map[key].component.render(canvasRef, form, workarea),
					}))}
				/>
				<section className="rde-size-scheme-section">
					<Form.Item name="pageCount" hidden>
						<InputNumber />
					</Form.Item>
					<div className="rde-size-scheme-toolbar">
						<div className="rde-size-scheme-heading">
							<strong>尺寸方案</strong>
							<span>{sizeSchemes.length} 个成品规格</span>
						</div>
						<Space size={4}>
							<Button type="text" size="small" icon={<PlusOutlined />} onClick={onAddSizeScheme}>
								新增
							</Button>
							<Popconfirm
								title="保存尺寸方案"
								description="保存会同时保存当前选中规格模板的数据"
								okText="确认保存"
								cancelText="取消"
								onConfirm={() => {
									void form.validateFields([
										'sizeSchemeLabel',
										'pageCountOptions',
										'pageCount',
										'unit',
										'sideWidth',
										'sideHeight',
										...(usesSeparateBleed ? ['horizontalBleed', 'verticalBleed'] : ['bleed']),
										'spineWidthMode',
										'spineWidth',
										'spineBleed',
										'minSpineWidth',
										'maxSpineWidth',
										'paperThickness',
										'backCoverSafeDistance',
										'coverSafeDistance',
										'spineSafeDistance',
									]).then(values => {
										const allValues = form.getFieldsValue(true);
										onSaveSizeScheme({
											label: values.sizeSchemeLabel.trim(),
											unit: allValues.unit,
											pageCount: allValues.pageCount,
											pageCountOptions: allValues.pageCountOptions,
											sideWidth: allValues.sideWidth,
											sideHeight: allValues.sideHeight,
											bleed: usesSeparateBleed ? allValues.horizontalBleed ?? 0 : allValues.bleed ?? 0,
											separateBleed: usesSeparateBleed,
											horizontalBleed: usesSeparateBleed ? allValues.horizontalBleed ?? 0 : allValues.bleed ?? 0,
											verticalBleed: usesSeparateBleed ? allValues.verticalBleed ?? 0 : allValues.bleed ?? 0,
											spineWidthMode: allValues.spineWidthMode ?? 'fixed',
											spineWidth: allValues.spineWidth ?? 0,
											minSpineWidth: allValues.minSpineWidth ?? 0,
											maxSpineWidth: allValues.maxSpineWidth ?? 0,
											spineBleed: allValues.spineBleed ?? 0,
											backCoverSafeDistance: allValues.backCoverSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
											coverSafeDistance: allValues.coverSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
											spineSafeDistance: allValues.spineSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
											paperThickness: allValues.paperThickness ?? 0,
										});
									});
								}}
							>
							<Button
								type="primary"
								ghost
								size="small"
								icon={<SaveOutlined />}
							>
								保存
							</Button>
							</Popconfirm>
						</Space>
					</div>
					<div className="rde-size-scheme-cards" role="listbox" aria-label="尺寸规格">
						<div className="rde-size-scheme-hint">切换规格时，请注意有没有调整模板，保存后再切换。</div>
						{sizeSchemes.map(item => {
							const active = item.id === activeSizeScheme?.id;
							return (
								<Card
									key={item.id}
									size="small"
									hoverable
									className={`rde-size-scheme-card${active ? ' is-active' : ''}`}
									role="option"
									tabIndex={0}
									aria-selected={active}
									onClick={() => onSelectSizeScheme(item.id)}
									onKeyDown={event => {
										if (event.key === 'Enter' || event.key === ' ') {
											event.preventDefault();
											onSelectSizeScheme(item.id);
										}
									}}
								>
									<span className="rde-size-scheme-card-label">
										<strong>{item.label}</strong>
									</span>
									<Popconfirm
										title="删除尺寸方案"
										description={`确定删除“${item.label}”吗？`}
										okText="删除"
										cancelText="取消"
										disabled={sizeSchemes.length <= 1}
										onConfirm={() => onDeleteSizeScheme(item.id)}
									>
										<Tooltip title={sizeSchemes.length <= 1 ? '至少保留一个尺寸方案' : '删除尺寸方案'}>
											<Button
												type="text"
												danger
												size="small"
												className="rde-size-scheme-delete"
												icon={<DeleteOutlined />}
												disabled={sizeSchemes.length <= 1}
												aria-label={`删除 ${item.label}`}
												onClick={event => event.stopPropagation()}
												onKeyDown={event => event.stopPropagation()}
											/>
										</Tooltip>
									</Popconfirm>
								</Card>
							);
						})}
					</div>
					<Row gutter={8} className="rde-size-scheme-identity-row">
						<Col flex="auto">
							<Form.Item
								label="尺寸显示名称"
								name="sizeSchemeLabel"
								rules={[
									{ required: true, message: '请输入尺寸显示名称' },
									{ whitespace: true, message: '尺寸显示名称不能为空' },
									{
										validator: (_rule, value) => {
											const name = String(value ?? '').trim();
											const duplicated = name && sizeSchemes.some(item => (
												item.id !== activeSizeScheme?.id
												&& (item.id === name || item.label.trim() === name)
											));
											return duplicated
												? Promise.reject(new Error('尺寸显示名称不能重复'))
												: Promise.resolve();
										},
									},
								]}
							>
								<Input placeholder={'例如 9\u00d76'} />
							</Form.Item>
						</Col>
						<Col flex="72px">
							<Form.Item
								label="单位"
								name="unit"
								rules={[{ required: true, message: '请选择单位' }]}
							>
								<Select
									options={[
										{ value: 'in', label: 'in' },
										{ value: 'cm', label: 'cm' },
										{ value: 'mm', label: 'mm' },
									]}
								/>
							</Form.Item>
										</Col>
									</Row>
					<Row gutter={8}>
						<Col span={12}>
							<Form.Item label="单面宽" name="sideWidth" rules={[{ required: true, message: '请输入单面宽' }]}>
								<InputNumber min={0} precision={4} style={{ width: '100%' }} />
							</Form.Item>
						</Col>
						<Col span={12}>
							<Form.Item label="单面高" name="sideHeight" rules={[{ required: true, message: '请输入单面高' }]}>
								<InputNumber min={0} precision={4} style={{ width: '100%' }} />
											</Form.Item>
										</Col>
									</Row>
					<Row gutter={8}>
						{usesSeparateBleed ? (
							<>
								<Col span={12}>
									<Form.Item label="左右出血" name="horizontalBleed" rules={[{ required: true, message: '请输入左右出血' }]}>
										<InputNumber min={0} precision={4} style={{ width: '100%' }} />
									</Form.Item>
								</Col>
								<Col span={12}>
									<Form.Item label="上下出血" name="verticalBleed" rules={[{ required: true, message: '请输入上下出血' }]}>
										<InputNumber min={0} precision={4} style={{ width: '100%' }} />
									</Form.Item>
								</Col>
							</>
						) : (
							<Col span={12}>
								<Form.Item label="出血" name="bleed" rules={[{ required: true, message: '请输入出血' }]}>
									<InputNumber min={0} precision={4} style={{ width: '100%' }} />
								</Form.Item>
							</Col>
						)}
						<Col span={usesSeparateBleed ? 24 : 12}>
							<Form.Item label="背脊依据" name="spineWidthMode" rules={[{ required: true, message: '请选择背脊依据' }]}>
								<Segmented
									block
									size="small"
									options={[
										{ value: 'fixed', label: '固定' },
										{ value: 'by_page_count', label: '按页数' },
									]}
								/>
							</Form.Item>
						</Col>
					</Row>
					<Row gutter={8}>
						<Col span={12}>
							<Form.Item
								label={selectedSpineWidthMode === 'by_page_count' ? '每页背脊宽' : '背脊宽'}
								name="spineWidth"
								rules={[{ required: true, message: '请输入背脊宽' }]}
							>
								<InputNumber min={0} precision={4} style={{ width: '100%' }} />
							</Form.Item>
						</Col>
						<Col span={12}>
							<Form.Item label="背脊出血" name="spineBleed" rules={[{ required: true, message: '请输入背脊出血' }]}>
								<InputNumber min={0} precision={4} style={{ width: '100%' }} />
							</Form.Item>
						</Col>
					</Row>
					<Row gutter={8}>
						<Col span={12}>
							<Form.Item label="最小背脊宽" name="minSpineWidth" rules={[{ required: true, message: '请输入最小背脊宽' }]}>
								<InputNumber min={0} precision={4} style={{ width: '100%' }} />
							</Form.Item>
						</Col>
						<Col span={12}>
							<Form.Item
								label="最大背脊宽"
								name="maxSpineWidth"
								dependencies={['minSpineWidth']}
								rules={[
									{ required: true, message: '请输入最大背脊宽' },
									({ getFieldValue }) => ({
										validator: (_rule, value) => Number(value) === 0 || Number(value) >= Number(getFieldValue('minSpineWidth') || 0)
											? Promise.resolve()
											: Promise.reject(new Error('背脊最大值不能小于最小值')),
									}),
								]}
							>
								<InputNumber min={0} precision={4} style={{ width: '100%' }} />
							</Form.Item>
						</Col>
									</Row>
									<Row gutter={8}>
										<Col span={24}>
											<Form.Item label="纸张厚度" name="paperThickness" rules={[{ required: true, message: '请输入纸张厚度' }]}>
												<InputNumber min={0} precision={4} addonAfter="mm" disabled={selectedSpineWidthMode !== 'by_page_count'} style={{ width: '100%' }} />
											</Form.Item>
										</Col>
									</Row>
									<Row gutter={8}>
										<Col span={24}>
											<Form.Item
												label="页数选项"
												name="pageCountOptions"
												rules={[
													{ required: true, message: '请至少添加一个页数选项' },
													{
														validator: (_rule, value) => Array.isArray(value) && value.length
															? Promise.resolve()
															: Promise.reject(new Error('请至少添加一个页数选项')),
													},
												]}
											>
												<PageCountOptionsEditor selected={selectedPageCount} onSelect={selectPageCount} />
											</Form.Item>
										</Col>
									</Row>
								</section>
			</Form>
		</Scrollbar>
	);
};

export default MapProperties;
