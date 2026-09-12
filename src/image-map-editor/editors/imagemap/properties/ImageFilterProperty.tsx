import { Form, Slider, Tag } from 'antd';
import i18next from 'i18next';
import React from 'react';

type ImageFilterData = {
	filters: any[];
};

type FilterToggleDefinition = {
	key: string;
	label: string;
	index: number;
	text: string;
};

const simpleFilters: FilterToggleDefinition[] = [
	{ key: 'grayscale', label: 'imagemap.filter.grayscale', index: 0, text: 'G' },
	{ key: 'invert', label: 'imagemap.filter.invert', index: 1, text: 'I' },
	{ key: 'sepia', label: 'imagemap.filter.sepia', index: 3, text: 'S' },
	{ key: 'brownie', label: 'imagemap.filter.brownie', index: 4, text: 'B' },
	{ key: 'vintage', label: 'imagemap.filter.vintage', index: 9, text: 'V' },
	{ key: 'blackwhite', label: 'imagemap.filter.blackwhite', index: 19, text: 'B' },
	{ key: 'technicolor', label: 'imagemap.filter.technicolor', index: 14, text: 'T' },
	{ key: 'polaroid', label: 'imagemap.filter.polaroid', index: 15, text: 'P' },
	{ key: 'sharpen', label: 'imagemap.filter.sharpen', index: 12, text: 'S' },
	{ key: 'emboss', label: 'imagemap.filter.emboss', index: 13, text: 'E' },
];

const FilterToggle = ({ definition, form, filters }: { definition: FilterToggleDefinition; form: any; filters: any[] }) => (
	<div className="rde-image-filter-toggle">
		<span className="rde-image-filter-toggle-label" title={i18next.t(definition.label)}>
			{i18next.t(definition.label)}
		</span>
		<Form.Item
			noStyle
			name={['filters', definition.key]}
			initialValue={!!filters[definition.index]}
			valuePropName="checked"
		>
			<Tag.CheckableTag checked={false} className="rde-action-tag rde-image-filter-toggle-tag">
				{definition.text}
			</Tag.CheckableTag>
		</Form.Item>
	</div>
);

const FilterRange = ({
	label,
	enabled,
	name,
	initialValue,
	min,
	max,
	step,
	}: {
	label: string;
	enabled: boolean;
	name: string[];
	initialValue: number;
	min: number;
	max: number;
	step: number;
}) => (
	<div className="rde-image-filter-range">
		<div className="rde-image-filter-range-label" title={label}>{label}</div>
		<Form.Item noStyle name={name} initialValue={initialValue}>
			<Slider disabled={!enabled} step={step} min={min} max={max} />
		</Form.Item>
	</div>
);

export default {
	render(_canvasRef: unknown, form: any, data: ImageFilterData) {
		const { filters = [] } = data;
		const gammaEnabled = Form.useWatch(['filters', 'gamma', 'enabled'], form) ?? !!filters[17];
		const brightnessEnabled = Form.useWatch(['filters', 'brightness', 'enabled'], form) ?? !!filters[5];
		const contrastEnabled = Form.useWatch(['filters', 'contrast', 'enabled'], form) ?? !!filters[6];
		const saturationEnabled = Form.useWatch(['filters', 'saturation', 'enabled'], form) ?? !!filters[7];
		const hueEnabled = Form.useWatch(['filters', 'hue', 'enabled'], form) ?? !!filters[21];
		const noiseEnabled = Form.useWatch(['filters', 'noise', 'enabled'], form) ?? !!filters[8];
		const pixelateEnabled = Form.useWatch(['filters', 'pixelate', 'enabled'], form) ?? !!filters[10];
		const blurEnabled = Form.useWatch(['filters', 'blur', 'enabled'], form) ?? !!filters[11];
		const filterLabel = (key: string) => i18next.t(key);
		const adjustableFilters = [
			{ key: 'brightness', enabled: brightnessEnabled, index: 5, field: 'brightness', fallback: 0.1, min: -1, max: 1, step: 0.01 },
			{ key: 'contrast', enabled: contrastEnabled, index: 6, field: 'contrast', fallback: 0, min: -1, max: 1, step: 0.01 },
			{ key: 'saturation', enabled: saturationEnabled, index: 7, field: 'saturation', fallback: 0, min: -1, max: 1, step: 0.01 },
			{ key: 'hue', enabled: hueEnabled, index: 21, field: 'rotation', fallback: 0, min: -2, max: 2, step: 0.002 },
			{ key: 'noise', enabled: noiseEnabled, index: 8, field: 'noise', fallback: 100, min: 0, max: 1000, step: 1 },
			{ key: 'pixelate', enabled: pixelateEnabled, index: 10, field: 'blocksize', fallback: 4, min: 2, max: 20, step: 1 },
			{ key: 'blur', enabled: blurEnabled, index: 11, field: 'value', fallback: 0.1, min: 0, max: 1, step: 0.01 },
		];

		return (
			<div className="rde-image-filter-panel">
				<div className="rde-image-filter-section-title">滤镜</div>
				<div className="rde-image-filter-toggle-grid">
					{simpleFilters.map(definition => (
						<FilterToggle key={definition.key} definition={definition} form={form} filters={filters} />
					))}
				</div>

				<div className="rde-image-filter-range-group">
					<div className="rde-image-filter-range-heading">
						<span>{filterLabel('imagemap.filter.gamma')}</span>
						<Form.Item
							noStyle
							name={['filters', 'gamma', 'enabled']}
							initialValue={!!filters[17]}
							valuePropName="checked"
						>
			<Tag.CheckableTag checked={false} className="rde-action-tag rde-image-filter-toggle-tag">G</Tag.CheckableTag>
						</Form.Item>
					</div>
					<div className="rde-image-filter-channel-grid">
						<FilterRange label={filterLabel('color.red')} enabled={gammaEnabled} name={['filters', 'gamma', 'r']} initialValue={filters[17]?.gamma?.[0] ?? 1} min={0.01} max={2.2} step={0.01} />
						<FilterRange label={filterLabel('color.green')} enabled={gammaEnabled} name={['filters', 'gamma', 'g']} initialValue={filters[17]?.gamma?.[1] ?? 1} min={0.01} max={2.2} step={0.01} />
						<FilterRange label={filterLabel('color.blue')} enabled={gammaEnabled} name={['filters', 'gamma', 'b']} initialValue={filters[17]?.gamma?.[2] ?? 1} min={0.01} max={2.2} step={0.01} />
					</div>
				</div>

				<div className="rde-image-filter-range-list">
					{adjustableFilters.map(item => (
						<div className="rde-image-filter-range-row" key={item.key}>
							<div className="rde-image-filter-range-heading">
								<span title={filterLabel(`imagemap.filter.${item.key}`)}>{filterLabel(`imagemap.filter.${item.key}`)}</span>
								<Form.Item
									noStyle
									name={['filters', item.key, 'enabled']}
									initialValue={!!filters[item.index]}
									valuePropName="checked"
								>
									<Tag.CheckableTag checked={false} className="rde-action-tag rde-image-filter-toggle-tag">{item.key.slice(0, 1).toUpperCase()}</Tag.CheckableTag>
								</Form.Item>
							</div>
							<FilterRange
								label=""
								enabled={item.enabled}
								name={['filters', item.key, item.field]}
								initialValue={filters[item.index]?.[item.field] ?? item.fallback}
								min={item.min}
								max={item.max}
								step={item.step}
							/>
						</div>
					))}
				</div>
			</div>
		);
	},
};
