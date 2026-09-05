import {
	ApartmentOutlined,
	ArrowRightOutlined,
	BarsOutlined,
	BorderOutlined,
	BoxPlotOutlined,
	CodeOutlined,
	EnvironmentOutlined,
	FileImageOutlined,
	FileOutlined,
	FontSizeOutlined,
	LayoutOutlined,
	LineChartOutlined,
	MinusOutlined,
	PictureOutlined,
	PlaySquareOutlined,
	QuestionOutlined,
	VideoCameraOutlined,
} from '@ant-design/icons';
import React from 'react';

interface ImageMapObjectIconProps {
	className?: string;
	style?: React.CSSProperties;
	type?: string;
}

const OBJECT_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
	'i-text': EnvironmentOutlined,
	arrow: ArrowRightOutlined,
	chart: LineChartOutlined,
	circle: BorderOutlined,
	cube: BoxPlotOutlined,
	dashedRect: BorderOutlined,
	element: CodeOutlined,
	gif: FileImageOutlined,
	iframe: LayoutOutlined,
	image: PictureOutlined,
	line: MinusOutlined,
	lines: BarsOutlined,
	polygon: ApartmentOutlined,
	rect: BorderOutlined,
	svg: PlaySquareOutlined,
	textbox: FontSizeOutlined,
	triangle: PlaySquareOutlined,
	video: VideoCameraOutlined,
	group: FileOutlined,
};

export default function ImageMapObjectIcon({ className, style, type }: ImageMapObjectIconProps) {
	const normalizedType = type?.toLowerCase() === 'dashedrect' ? 'dashedRect' : type || '';
	const IconComponent = OBJECT_ICONS[normalizedType] || QuestionOutlined;
	return <IconComponent className={className} style={style} />;
}
