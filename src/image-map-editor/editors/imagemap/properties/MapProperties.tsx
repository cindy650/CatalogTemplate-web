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
	resolveImageMapSpinePageRule,
	resolveImageMapSpineWidth,
	type ImageMapSizeSchemeValue,
} from '../ImageMapSizeScheme';
import PropertyDefinition from './PropertyDefinition';

interface PageCountOptionsEditorProps {
	value?: number[];
	selected?: number;
	onChange?: (value: number[]) => void;
	onSelect: (value: number) => void;
	allowEdit?: boolean;
}

const PageCountOptionsEditor = ({
	value = [],
	selected,
	onChange,
	onSelect,
	allowEdit = false,
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
					{allowEdit ? <Tooltip title={options.length <= 1 ? '至少保留一个页数选项' : `删除 ${pageCount} 页`}>
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
					</Tooltip> : null}
				</div>
			))}
			{allowEdit && adding ? (
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
			) : allowEdit ? (
				<Button
					type="dashed"
					size="small"
					className="rde-page-count-add"
					icon={<PlusOutlined />}
					onClick={() => setAdding(true)}
				>
					添加页数
				</Button>
			) : null}
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
	onRegisterSaveSizeScheme?: (handler: () => void) => void;
	hideSizeSchemeSaveButton?: boolean;
	onSelectSizeScheme: (id: string) => void;
	simplified?: boolean;
	hideCanvasSection?: boolean;
	fontLayoutTrigger?: React.ReactNode;
	fontLayoutSelection?: React.ReactNode;
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
	onRegisterSaveSizeScheme,
	hideSizeSchemeSaveButton,
	onSelectSizeScheme,
	simplified = false,
	hideCanvasSection = true,
	fontLayoutTrigger,
	fontLayoutSelection,
}: MapPropertiesProps) => {
	const [form] = Form.useForm();
	const workarea = canvasRef?.handler?.workarea;
	const activeSizeScheme = sizeSchemes.find(item => item.id === activeSizeSchemeId) ?? sizeSchemes[0];
	const selectedPageCount = Form.useWatch('pageCount', form);
	const selectedSpineWidthMode = Form.useWatch('spineWidthMode', form);
	const selectedUnit = Form.useWatch('unit', form) as ImageMapSizeSchemeValue['unit'] | undefined;
	const selectedSpineWidthFormula = Form.useWatch('spineWidthFormula', form);
	const hasSpineWidthFormula = Boolean(activeSizeScheme?.spineWidthFormula);
	const activeSpineWidthBasis = activeSizeScheme?.spineWidthBasis
		?? (hasSpineWidthFormula ? 'formula' : selectedSpineWidthMode === 'by_page_count' ? 'page_count_table' : 'range');
	const usesSpineWidthFormula = activeSpineWidthBasis === 'formula' && hasSpineWidthFormula && Boolean(selectedSpineWidthFormula);
	const usesSpineWidthPageTable = activeSpineWidthBasis === 'page_count_table';
	const usesSeparateBleed = activeSizeScheme?.separateBleed === true;
	const unitRef = React.useRef(activeSizeScheme?.unit ?? 'in');
	const selectedCanvasUnit = selectedUnit ?? activeSizeScheme?.unit ?? 'in';
	const pageRule = usesSpineWidthPageTable
		? resolveImageMapSpinePageRule(
			activeSizeScheme?.spineWidthPageRules,
			Number(selectedPageCount ?? activeSizeScheme?.pageCount),
			selectedCanvasUnit,
		)
		: undefined;
	const calculatedSpineWidth = usesSpineWidthPageTable && pageRule
		? pageRule.spineWidth
		: resolveImageMapSpineWidth({
		...form.getFieldsValue(true),
		pageCount: selectedPageCount,
		unit: selectedCanvasUnit,
		spineWidthMode: selectedSpineWidthMode,
		spineWidthFormula: selectedSpineWidthFormula,
		});
	const calculatedSpineBleed = usesSpineWidthPageTable && pageRule
		? pageRule.spineBleed
		: usesSpineWidthFormula && activeSizeScheme?.spineWidthFormula
			? (() => {
				const inches: Record<ImageMapSizeSchemeValue['unit'], number> = { in: 1, cm: 1 / 2.54, mm: 1 / 25.4 };
				const formula = activeSizeScheme.spineWidthFormula;
				return Number((Number(formula.spineBleed || 0) * inches[formula.unit] / inches[selectedCanvasUnit]).toFixed(4));
			})()
			: Number(form.getFieldValue('spineBleed') ?? activeSizeScheme?.spineBleed ?? 0);

	const saveSizeScheme = React.useCallback(() => {
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
			...(usesSpineWidthFormula ? [
				['spineWidthFormula', 'unit'],
				['spineWidthFormula', 'pageCountCoefficient'],
				['spineWidthFormula', 'pageCountThickness'],
				['spineWidthFormula', 'baseWidth'],
				['spineWidthFormula', 'additionalWidth'],
			] : usesSpineWidthPageTable ? [] : ['spineBleed', 'minSpineWidth', 'maxSpineWidth']),
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
				spineWidthBasis: activeSpineWidthBasis,
				...(activeSizeScheme?.spineWidthPageRules ? { spineWidthPageRules: activeSizeScheme.spineWidthPageRules } : {}),
				spineWidth: usesSpineWidthFormula || usesSpineWidthPageTable ? calculatedSpineWidth : allValues.spineWidth ?? 0,
				minSpineWidth: usesSpineWidthFormula || usesSpineWidthPageTable ? 0 : allValues.minSpineWidth ?? 0,
				maxSpineWidth: usesSpineWidthFormula || usesSpineWidthPageTable ? 0 : allValues.maxSpineWidth ?? 0,
				spineBleed: usesSpineWidthFormula || usesSpineWidthPageTable ? calculatedSpineBleed : allValues.spineBleed ?? 0,
				...(usesSpineWidthFormula ? { spineWidthFormula: {
					unit: allValues.spineWidthFormula?.unit ?? 'cm',
					pageCountCoefficient: Number(allValues.spineWidthFormula?.pageCountCoefficient) || 0,
					pageCountThickness: Number(allValues.spineWidthFormula?.pageCountThickness) || 0,
					baseWidth: Number(allValues.spineWidthFormula?.baseWidth) || 0,
					additionalWidth: Number(allValues.spineWidthFormula?.additionalWidth) || 0,
					spineBleed: calculatedSpineBleed,
				} } : {}),
				backCoverSafeDistance: allValues.backCoverSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
				coverSafeDistance: allValues.coverSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
				spineSafeDistance: allValues.spineSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
				paperThickness: usesSpineWidthFormula || usesSpineWidthPageTable ? 0 : allValues.paperThickness ?? 0,
			});
		});
	}, [activeSpineWidthBasis, calculatedSpineBleed, calculatedSpineWidth, form, onSaveSizeScheme, usesSeparateBleed, usesSpineWidthFormula, usesSpineWidthPageTable]);

	React.useEffect(() => {
		onRegisterSaveSizeScheme?.(saveSizeScheme);
	}, [onRegisterSaveSizeScheme, saveSizeScheme]);

	const workareaValues = React.useCallback((values: Record<string, any>) => {
		const printValues: Record<string, any> = {
			...values,
			separateBleed: usesSeparateBleed,
			bleed: usesSeparateBleed ? values.horizontalBleed : values.bleed,
			spineWidthMode: values.spineWidthMode === 'by_page_count' ? 'by_page_count' : 'fixed',
			// Keep the product strategy available to the final resolver. Without
			// this metadata a page-table value can be recalculated by a product
			// formula that happens to be present on the same product.
			spineWidthBasis: activeSpineWidthBasis,
			...(activeSizeScheme?.spineWidthPageRules ? { spineWidthPageRules: activeSizeScheme.spineWidthPageRules } : {}),
			...(hasSpineWidthFormula && (values.spineWidthFormula ?? activeSizeScheme?.spineWidthFormula)
				? { spineWidthFormula: values.spineWidthFormula ?? activeSizeScheme?.spineWidthFormula }
				: {}),
		};
		if (usesSpineWidthPageTable && activeSizeScheme?.spineWidthPageRules) {
			const targetUnit: ImageMapSizeSchemeValue['unit'] = values.unit === 'cm' || values.unit === 'mm' ? values.unit : 'in';
			const rule = resolveImageMapSpinePageRule(
				activeSizeScheme.spineWidthPageRules,
				Number(values.pageCount ?? activeSizeScheme.pageCount),
				targetUnit,
			);
			if (rule) {
				printValues.spineWidth = rule.spineWidth;
				printValues.spineBleed = rule.spineBleed;
			}
		}
		delete printValues.backCoverSafeDistance;
		delete printValues.coverSafeDistance;
		delete printValues.spineSafeDistance;
		return {
			...printValues,
			spineWidth: resolveImageMapSpineWidth(printValues),
		};
	}, [activeSizeScheme?.pageCount, activeSizeScheme?.spineWidthFormula, activeSizeScheme?.spineWidthMode, activeSizeScheme?.spineWidthPageRules, activeSpineWidthBasis, hasSpineWidthFormula, usesSeparateBleed, usesSpineWidthPageTable]);

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
			'spineWidthFormula',
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
		form.resetFields(['spineWidthFormula']);

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
			spineWidthMode: activeSizeScheme?.spineWidthMode === 'by_page_count' ? 'by_page_count' : 'fixed',
			spineWidth: activeSizeScheme?.spineWidth ?? workarea.spineWidth ?? 0.55,
			minSpineWidth: activeSizeScheme?.minSpineWidth ?? 0.55,
			maxSpineWidth: activeSizeScheme?.maxSpineWidth ?? 0.7,
			spineBleed: activeSizeScheme?.spineBleed ?? workarea.spineBleed ?? 0.55,
			...(activeSizeScheme?.spineWidthFormula
				? { spineWidthFormula: activeSizeScheme.spineWidthFormula }
				: {}),
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

	if (simplified) {
		return (
			<Scrollbar>
				<Form
					form={form}
					{...INSPECTOR_FORM_PROPS}
					onValuesChange={(changedValues, allValues) => {
						if (Object.hasOwn(changedValues, 'unit')) {
							const nextUnit = changedValues.unit as ImageMapSizeSchemeValue['unit'];
							const convertedValues = convertImageMapSizeSchemeUnit(allValues, unitRef.current, nextUnit);
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
						defaultActiveKey={['image']}
						items={[{
							key: 'image',
							label: PropertyDefinition.map.image.title,
							children: PropertyDefinition.map.image.component.render(canvasRef, form, workarea),
						}]}
					/>
					{fontLayoutTrigger}
					{fontLayoutSelection}
					<section className="rde-size-scheme-section is-simplified">
						<div className="rde-size-scheme-heading"><strong>画布尺寸</strong><span>{activeSizeScheme?.label}</span></div>
						<Form.Item label="单位" name="unit" className="rde-size-scheme-unit-field">
							<Select
								options={[
									{ value: 'in', label: 'in' },
									{ value: 'cm', label: 'cm' },
									{ value: 'mm', label: 'mm' },
								]}
							/>
						</Form.Item>
						<Row gutter={8}>
							<Col span={12}><Form.Item label="单面宽" name="sideWidth"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
							<Col span={12}><Form.Item label="单面高" name="sideHeight"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
						</Row>
						{usesSeparateBleed ? <Row gutter={8}>
							<Col span={12}><Form.Item label="左右出血" name="horizontalBleed"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
							<Col span={12}><Form.Item label="上下出血" name="verticalBleed"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
						</Row> : <Form.Item label="出血" name="bleed"><InputNumber style={{ width: '100%' }} /></Form.Item>}
						<Row gutter={8}>
							<Col span={12}><Form.Item label="背脊宽" name="spineWidth"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
							<Col span={12}><Form.Item label="背脊出血" name="spineBleed"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
						</Row>
					</section>
				</Form>
			</Scrollbar>
		);
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
					items={Object.keys(PropertyDefinition.map)
						.filter(key => (!simplified || key === 'image') && (!hideCanvasSection || key !== 'map'))
						.map(key => ({
						key,
						label: PropertyDefinition.map[key].title,
						showArrow: true,
						children: PropertyDefinition.map[key].component.render(canvasRef, form, workarea),
					}))}
				/>
				{fontLayoutTrigger}
				{fontLayoutSelection}
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
							{!hideSizeSchemeSaveButton ? <Popconfirm
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
											...(usesSpineWidthFormula ? [
												['spineWidthFormula', 'unit'],
												['spineWidthFormula', 'pageCountCoefficient'],
												['spineWidthFormula', 'pageCountThickness'],
												['spineWidthFormula', 'baseWidth'],
												['spineWidthFormula', 'additionalWidth'],
											] : ['spineBleed']),
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
								spineWidth: usesSpineWidthFormula
													? resolveImageMapSpineWidth(allValues)
													: allValues.spineWidth ?? 0,
														minSpineWidth: usesSpineWidthFormula ? 0 : allValues.minSpineWidth ?? 0,
														maxSpineWidth: usesSpineWidthFormula ? 0 : allValues.maxSpineWidth ?? 0,
														spineBleed: usesSpineWidthFormula ? 0 : allValues.spineBleed ?? 0,
														...(usesSpineWidthFormula ? { spineWidthFormula: {
													unit: allValues.spineWidthFormula?.unit ?? 'cm',
													pageCountCoefficient: Number(allValues.spineWidthFormula?.pageCountCoefficient) || 0,
													pageCountThickness: Number(allValues.spineWidthFormula?.pageCountThickness) || 0,
													baseWidth: Number(allValues.spineWidthFormula?.baseWidth) || 0,
													additionalWidth: Number(allValues.spineWidthFormula?.additionalWidth) || 0,
													spineBleed: 0,
												} } : {}),
											backCoverSafeDistance: allValues.backCoverSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
											coverSafeDistance: allValues.coverSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
											spineSafeDistance: allValues.spineSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
														paperThickness: usesSpineWidthFormula ? 0 : allValues.paperThickness ?? 0,
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
							</Popconfirm> : null}
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
							<Form.Item label="背脊依据">
								<Segmented
									block
									size="small"
									disabled
									value={activeSpineWidthBasis}
									options={[
										{ value: 'range', label: '固定范围' },
										{ value: 'formula', label: '产品公式' },
										{ value: 'page_count_table', label: '按页数分段' },
									]}
								/>
							</Form.Item>
						</Col>
					</Row>
					{usesSpineWidthFormula ? (
						<div className="rde-spine-width-formula-editor">
							<div className="rde-spine-width-formula-title">按页数背脊宽公式</div>
							<div className="rde-spine-width-formula-hint">背脊宽 = 页数 × 系数 × 每页厚度 + 基础宽度 + 附加宽度</div>
							<Row gutter={8}>
								<Col span={8}><Form.Item label="公式单位" name={['spineWidthFormula', 'unit']} rules={[{ required: true, message: '请选择公式单位' }]}><Select disabled options={[{ value: 'cm', label: 'cm' }, { value: 'mm', label: 'mm' }, { value: 'in', label: 'in' }]} /></Form.Item></Col>
								<Col span={8}><Form.Item label="页数系数" name={['spineWidthFormula', 'pageCountCoefficient']} rules={[{ required: true, message: '请输入页数系数' }]}><InputNumber disabled min={0} precision={4} style={{ width: '100%' }} /></Form.Item></Col>
								<Col span={8}><Form.Item label="每页厚度" name={['spineWidthFormula', 'pageCountThickness']} rules={[{ required: true, message: '请输入每页厚度' }]}><InputNumber disabled min={0} precision={4} style={{ width: '100%' }} /></Form.Item></Col>
							</Row>
							<Row gutter={8}>
								<Col span={8}><Form.Item label="基础宽度" name={['spineWidthFormula', 'baseWidth']} rules={[{ required: true, message: '请输入基础宽度' }]}><InputNumber disabled min={0} precision={4} style={{ width: '100%' }} /></Form.Item></Col>
								<Col span={8}><Form.Item label="附加宽度" name={['spineWidthFormula', 'additionalWidth']} rules={[{ required: true, message: '请输入附加宽度' }]}><InputNumber disabled min={0} precision={4} style={{ width: '100%' }} /></Form.Item></Col>
								<Col span={8}><Form.Item label="背脊出血"><InputNumber value={calculatedSpineBleed} addonAfter={selectedCanvasUnit} disabled style={{ width: '100%' }} /></Form.Item></Col>
							</Row>
							<Row gutter={8}>
								<Col span={8}>
									<Form.Item label="最终背脊宽">
										<InputNumber value={calculatedSpineWidth} addonAfter={selectedUnit ?? activeSizeScheme?.unit ?? 'in'} precision={4} disabled style={{ width: '100%' }} />
									</Form.Item>
								</Col>
							</Row>
						</div>
					) : null}
					{usesSpineWidthPageTable ? (
						<Row gutter={8}>
							<Col span={12}>
								<Form.Item label="背脊宽">
									<InputNumber value={calculatedSpineWidth} precision={4} disabled style={{ width: '100%' }} />
								</Form.Item>
							</Col>
							<Col span={12}>
								<Form.Item label="背脊出血">
									<InputNumber value={calculatedSpineBleed} addonAfter={selectedCanvasUnit} precision={4} disabled style={{ width: '100%' }} />
								</Form.Item>
							</Col>
						</Row>
					) : null}
					<Row gutter={8} style={usesSpineWidthFormula || usesSpineWidthPageTable ? { display: 'none' } : undefined}>
						<Col span={12}>
							<Form.Item
									label="背脊宽"
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
					<Row gutter={8} style={usesSpineWidthFormula || usesSpineWidthPageTable ? { display: 'none' } : undefined}>
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
