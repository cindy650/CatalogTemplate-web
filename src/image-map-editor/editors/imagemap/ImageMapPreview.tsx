import { CloseOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import clsx from 'clsx';
import React from 'react';

import Canvas from '../../canvas/Canvas';

interface ImageMapPreviewProps {
	preview?: boolean;
	onChangePreview?: () => void;
	onTooltip?: (...args: any[]) => any;
	onClick?: (...args: any[]) => any;
	objects?: any;
}

export default function ImageMapPreview({
	objects,
	onChangePreview,
	onClick,
	onTooltip,
	preview = false,
}: ImageMapPreviewProps) {
	const previewClassName = clsx('rde-preview', { preview });

	if (!preview) {
		return null;
	}

	return (
		<div className={previewClassName}>
			<div
				style={{
					overflow: 'hidden',
					display: 'flex',
					flex: '1',
					height: '100%',
				}}
			>
				<Canvas
					editable={false}
					className="rde-canvas"
					canvasOption={{
						perPixelTargetFind: true,
					}}
					canvasActions={{ transaction: false, grab: false, scroll: false, zoom: false }}
					onLoad={handler => handler.importJSON(objects)}
					onTooltip={onTooltip}
					onClick={onClick}
					maxZoom={500}
				/>
				<Button
					aria-label="关闭预览"
					className="rde-action-btn rde-preview-close-btn"
					icon={<CloseOutlined />}
					variant="text"
					onClick={onChangePreview}
				/>
			</div>
		</div>
	);
}
