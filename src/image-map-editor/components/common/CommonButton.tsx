import {
	AlignCenterOutlined,
	AlignLeftOutlined,
	AlignRightOutlined,
	ArrowDownOutlined,
	ArrowLeftOutlined,
	ArrowUpOutlined,
	CheckOutlined,
	CloseOutlined,
	CopyOutlined,
	DeleteOutlined,
	DownloadOutlined,
	DragOutlined,
	ExpandOutlined,
	GroupOutlined,
	MenuFoldOutlined,
	MenuUnfoldOutlined,
	PictureOutlined,
	ScissorOutlined,
	SelectOutlined,
	UngroupOutlined,
	UndoOutlined,
	UploadOutlined,
	VerticalAlignBottomOutlined,
	VerticalAlignTopOutlined,
	ZoomInOutlined,
	ZoomOutOutlined,
	RedoOutlined,
} from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import type { ButtonProps } from 'antd';
import React from 'react';

import Icon from '../icon/Icon';

const ANT_ICONS: Record<string, React.ReactNode> = {
	'align-center': <AlignCenterOutlined />,
	'align-left': <AlignLeftOutlined />,
	'align-right': <AlignRightOutlined />,
	'angle-double-down': <VerticalAlignBottomOutlined />,
	'angle-double-up': <VerticalAlignTopOutlined />,
	'angle-down': <ArrowDownOutlined />,
	'arrow-left': <ArrowLeftOutlined />,
	'angle-up': <ArrowUpOutlined />,
	check: <CheckOutlined />,
	clone: <CopyOutlined />,
	crop: <ScissorOutlined />,
	'file-download': <DownloadOutlined />,
	'file-upload': <UploadOutlined />,
	expand: <ExpandOutlined />,
	'hand-rock': <DragOutlined />,
	image: <PictureOutlined />,
	'angle-double-left': <MenuFoldOutlined />,
	'angle-double-right': <MenuUnfoldOutlined />,
	'mouse-pointer': <SelectOutlined />,
	'object-group': <GroupOutlined />,
	'object-ungroup': <UngroupOutlined />,
	'search-minus': <ZoomOutOutlined />,
	'search-plus': <ZoomInOutlined />,
	times: <CloseOutlined />,
	trash: <DeleteOutlined />,
	'undo-alt': <UndoOutlined />,
	'redo-alt': <RedoOutlined />,
};

interface CommonButtonProps extends ButtonProps {
	name?: string;
	id?: string;
	wrapperStyle?: React.CSSProperties;
	wrapperClassName?: string;
	tooltipTitle?: React.ReactNode;
	tooltipPlacement?: any;
	icon?: string;
	iconStyle?: React.CSSProperties;
	iconClassName?: string;
	iconAnimation?: string;
	visible?: boolean;
	children?: React.ReactNode;
}

export default function CommonButton({
	children,
	icon,
	iconAnimation,
	iconClassName,
	iconStyle,
	tooltipPlacement,
	tooltipTitle,
	visible = true,
	wrapperClassName,
	wrapperStyle,
	...buttonProps
}: CommonButtonProps) {
	if (!visible) {
		return null;
	}

	const content = (
		<Button
			{...buttonProps}
			icon={
				icon
					? ANT_ICONS[icon] || (
						<Icon name={icon} style={iconStyle} className={iconClassName} animation={iconAnimation} />
					)
					: undefined
			}
		>
			{children}
		</Button>
	);

	return (
		<Tooltip title={tooltipTitle} placement={tooltipPlacement}>
			{wrapperClassName || wrapperStyle ? (
				<span style={wrapperStyle} className={wrapperClassName}>
					{content}
				</span>
			) : (
				content
			)}
		</Tooltip>
	);
}
