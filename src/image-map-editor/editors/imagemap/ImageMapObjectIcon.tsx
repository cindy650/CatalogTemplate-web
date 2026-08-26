import {
	ApartmentOutlined,
	ArrowRightOutlined,
	BorderOutlined,
	BoxPlotOutlined,
	CodeOutlined,
	EnvironmentOutlined,
	FileImageOutlined,
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
	element: CodeOutlined,
	gif: FileImageOutlined,
	iframe: LayoutOutlined,
	image: PictureOutlined,
	line: MinusOutlined,
	polygon: ApartmentOutlined,
	rect: BorderOutlined,
	svg: PlaySquareOutlined,
	textbox: FontSizeOutlined,
	triangle: PlaySquareOutlined,
	video: VideoCameraOutlined,
};

export default function ImageMapObjectIcon({ className, style, type }: ImageMapObjectIconProps) {
	const IconComponent = OBJECT_ICONS[type || ''] || QuestionOutlined;
	return <IconComponent className={className} style={style} />;
}
