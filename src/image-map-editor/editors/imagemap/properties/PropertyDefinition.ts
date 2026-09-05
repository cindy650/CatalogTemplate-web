import AnimationProperty from './AnimationProperty';
import ChartProperty from './ChartProperty';
import DashedRectProperty from './DashedRectProperty';
import ElementProperty from './ElementProperty';
import GeneralProperty from './GeneralProperty';
import IframeProperty from './IframeProperty';
import ImageFilterProperty from './ImageFilterProperty';
import ImageProperty from './ImageProperty';
import LinkProperty from './LinkProperty';
import LinesProperty from './LinesProperty';
import MapProperty from './MapProperty';
import MarkerProperty from './MarkerProperty';
import ShadowProperty from './ShadowProperty';
import StyleProperty from './StyleProperty';
import SvgProperty from './SvgProperty';
import TextProperty from './TextProperty';
import TooltipProperty from './TooltipProperty';
import TriggerProperty from './TriggerProperty';
import UserProperty from './UserProperty';
import VideoProperty from './VideoProperty';

type PropertyRenderer = {
	render: (...args: any[]) => any;
};

type PropertySection = {
	title: string;
	component: PropertyRenderer;
};

type PropertyDefinitionMap = Record<string, Record<string, PropertySection>>;

const PropertyDefinition: PropertyDefinitionMap = {
	map: {
		map: {
			title: 'Map',
			component: MapProperty,
		},
		image: {
			title: 'Image',
			component: ImageProperty,
		},
	},
	group: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		shadow: {
			title: 'Shadow',
			component: ShadowProperty,
		},
	},
	'i-text': {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		marker: {
			title: 'Marker',
			component: MarkerProperty,
		},
		link: {
			title: 'Link',
			component: LinkProperty,
		},
		tooltip: {
			title: 'Tooltip',
			component: TooltipProperty,
		},
		style: {
			title: 'Style',
			component: StyleProperty,
		},
		shadow: {
			title: 'Shadow',
			component: ShadowProperty,
		},
		animation: {
			title: 'Animation',
			component: AnimationProperty,
		},
		trigger: {
			title: 'Trigger',
			component: TriggerProperty,
		},
		userProperty: {
			title: 'User Property',
			component: UserProperty,
		},
	},
	textbox: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		text: {
			title: 'Text',
			component: TextProperty,
		},
		link: {
			title: 'Link',
			component: LinkProperty,
		},
		tooltip: {
			title: 'Tooltip',
			component: TooltipProperty,
		},
		style: {
			title: 'Style',
			component: StyleProperty,
		},
		shadow: {
			title: 'Shadow',
			component: ShadowProperty,
		},
		animation: {
			title: 'Animation',
			component: AnimationProperty,
		},
		trigger: {
			title: 'Trigger',
			component: TriggerProperty,
		},
		userProperty: {
			title: 'User Property',
			component: UserProperty,
		},
	},
	image: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		image: {
			title: 'Image',
			component: ImageProperty,
		},
		filter: {
			title: 'Filter',
			component: ImageFilterProperty,
		},
		link: {
			title: 'Link',
			component: LinkProperty,
		},
		tooltip: {
			title: 'Tooltip',
			component: TooltipProperty,
		},
		style: {
			title: 'Style',
			component: StyleProperty,
		},
		shadow: {
			title: 'Shadow',
			component: ShadowProperty,
		},
		animation: {
			title: 'Animation',
			component: AnimationProperty,
		},
		trigger: {
			title: 'Trigger',
			component: TriggerProperty,
		},
		userProperty: {
			title: 'User Property',
			component: UserProperty,
		},
	},
	triangle: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		link: {
			title: 'Link',
			component: LinkProperty,
		},
		tooltip: {
			title: 'Tooltip',
			component: TooltipProperty,
		},
		style: {
			title: 'Style',
			component: StyleProperty,
		},
		shadow: {
			title: 'Shadow',
			component: ShadowProperty,
		},
		animation: {
			title: 'Animation',
			component: AnimationProperty,
		},
		trigger: {
			title: 'Trigger',
			component: TriggerProperty,
		},
		userProperty: {
			title: 'User Property',
			component: UserProperty,
		},
	},
	rect: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		link: {
			title: 'Link',
			component: LinkProperty,
		},
		tooltip: {
			title: 'Tooltip',
			component: TooltipProperty,
		},
		style: {
			title: 'Style',
			component: StyleProperty,
		},
		shadow: {
			title: 'Shadow',
			component: ShadowProperty,
		},
		animation: {
			title: 'Animation',
			component: AnimationProperty,
		},
		trigger: {
			title: 'Trigger',
			component: TriggerProperty,
		},
		userProperty: {
			title: 'User Property',
			component: UserProperty,
		},
	},
	circle: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		link: {
			title: 'Link',
			component: LinkProperty,
		},
		tooltip: {
			title: 'Tooltip',
			component: TooltipProperty,
		},
		style: {
			title: 'Style',
			component: StyleProperty,
		},
		shadow: {
			title: 'Shadow',
			component: ShadowProperty,
		},
		animation: {
			title: 'Animation',
			component: AnimationProperty,
		},
		trigger: {
			title: 'Trigger',
			component: TriggerProperty,
		},
		userProperty: {
			title: 'User Property',
			component: UserProperty,
		},
	},
	polygon: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		link: {
			title: 'Link',
			component: LinkProperty,
		},
		tooltip: {
			title: 'Tooltip',
			component: TooltipProperty,
		},
		style: {
			title: 'Style',
			component: StyleProperty,
		},
		shadow: {
			title: 'Shadow',
			component: ShadowProperty,
		},
		animation: {
			title: 'Animation',
			component: AnimationProperty,
		},
		trigger: {
			title: 'Trigger',
			component: TriggerProperty,
		},
		userProperty: {
			title: 'User Property',
			component: UserProperty,
		},
	},
	line: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		link: {
			title: 'Link',
			component: LinkProperty,
		},
		tooltip: {
			title: 'Tooltip',
			component: TooltipProperty,
		},
		style: {
			title: 'Style',
			component: StyleProperty,
		},
		shadow: {
			title: 'Shadow',
			component: ShadowProperty,
		},
		animation: {
			title: 'Animation',
			component: AnimationProperty,
		},
		trigger: {
			title: 'Trigger',
			component: TriggerProperty,
		},
		userProperty: {
			title: 'User Property',
			component: UserProperty,
		},
	},
	lines: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		lines: {
			title: 'Lines',
			component: LinesProperty,
		},
		shadow: {
			title: 'Shadow',
			component: ShadowProperty,
		},
	},
	dashedRect: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		dashedRect: {
			title: 'Dashed Rect',
			component: DashedRectProperty,
		},
		shadow: {
			title: 'Shadow',
			component: ShadowProperty,
		},
	},
	arrow: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		link: {
			title: 'Link',
			component: LinkProperty,
		},
		tooltip: {
			title: 'Tooltip',
			component: TooltipProperty,
		},
		style: {
			title: 'Style',
			component: StyleProperty,
		},
		shadow: {
			title: 'Shadow',
			component: ShadowProperty,
		},
		animation: {
			title: 'Animation',
			component: AnimationProperty,
		},
		trigger: {
			title: 'Trigger',
			component: TriggerProperty,
		},
		userProperty: {
			title: 'User Property',
			component: UserProperty,
		},
	},
	video: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		video: {
			title: 'Video',
			component: VideoProperty,
		},
	},
	element: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		video: {
			title: 'Element',
			component: ElementProperty,
		},
	},
	iframe: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		video: {
			title: 'Iframe',
			component: IframeProperty,
		},
	},
	svg: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		svg: {
			title: 'SVG',
			component: SvgProperty,
		},
		link: {
			title: 'Link',
			component: LinkProperty,
		},
		tooltip: {
			title: 'Tooltip',
			component: TooltipProperty,
		},
		style: {
			title: 'Style',
			component: StyleProperty,
		},
		shadow: {
			title: 'Shadow',
			component: ShadowProperty,
		},
		animation: {
			title: 'Animation',
			component: AnimationProperty,
		},
		trigger: {
			title: 'Trigger',
			component: TriggerProperty,
		},
		userProperty: {
			title: 'User Property',
			component: UserProperty,
		},
	},
	chart: {
		general: {
			title: 'General',
			component: GeneralProperty,
		},
		chartOption: {
			title: 'Chart Option',
			component: ChartProperty,
		},
	},
};

const propertyTitleTranslations: Record<string, string> = {
	Map: '画布', Image: '图片', General: '常规', Shadow: '阴影', Marker: '标记', Link: '链接', Tooltip: '提示',
	Style: '样式', Animation: '动画', Trigger: '触发器', 'User Property': '自定义属性', Text: '文本', Filter: '滤镜',
	Video: '视频', Element: '元素', Iframe: '内嵌页面', SVG: 'SVG', Lines: '线条', 'Dashed Rect': '虚线框', 'Chart Option': '图表配置',
};

Object.values(PropertyDefinition).forEach(sections => {
	['animation', 'trigger', 'userProperty', 'link', 'tooltip'].forEach(key => {
		delete sections[key];
	});
	Object.values(sections).forEach(section => {
		section.title = propertyTitleTranslations[section.title] || section.title;
	});
});

PropertyDefinition.map.image.title = '背景填充';

export default PropertyDefinition;
