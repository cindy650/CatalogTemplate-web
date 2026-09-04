import {
	ArrowDownOutlined,
	ArrowUpOutlined,
	CopyOutlined,
	DeleteOutlined,
	EyeInvisibleOutlined,
	EyeOutlined,
	LockOutlined,
	UnlockOutlined,
} from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import React from 'react';

import type { CanvasInstance } from '../../canvas';
import { Flex } from '../../components/flex';
import ImageMapObjectIcon from './ImageMapObjectIcon';

type CanvasListObject = {
	id?: string;
	name?: string;
	superType?: string;
	type?: string;
	locked?: boolean;
	visible?: boolean;
};

interface ImageMapListProps {
	canvasRef?: CanvasInstance | null;
	selectedItem?: { id?: string } | null;
}

const resolveListItem = (obj: CanvasListObject) => {
	let title = obj.name || obj.type || '默认';

	if (!obj.type) {
		title = '默认';
	}

	return { title };
};

export default function ImageMapList({ canvasRef, selectedItem }: ImageMapListProps) {
	const isCropping = canvasRef ? canvasRef.handler?.interactionMode === 'crop' : false;
	const objects =
		(canvasRef?.canvas.getObjects() as CanvasListObject[] | undefined)?.filter(obj => {
			if (obj.id === 'workarea') {
				return false;
			}
			return !!obj.id;
		}) || [];
	const updateLayer = (obj: CanvasListObject, values: Record<string, unknown>) => {
		const handler = canvasRef?.handler;
		if (!handler) return;
		Object.entries(values).forEach(([key, value]) => {
			handler.setByObject(obj as any, key, value);
		});
	};

	return (
		<Flex className="rde-canvas-list" style={{ height: '100%' }} flexDirection="column">
			<Flex.Item className="rde-canvas-list-actions" flex="0 1 auto">
				<Flex className="rde-canvas-list-order-actions" justifyContent="space-between" alignItems="center">
					<Flex flex="1" justifyContent="center">
						<Button
							className="rde-action-btn is-order"
							disabled={isCropping}
							icon={<ArrowUpOutlined />}
							aria-label="图层下移"
							onClick={() => canvasRef?.handler.sendBackwards()}
						/>
					</Flex>
					<Flex flex="1" justifyContent="center">
						<Button
							className="rde-action-btn is-order"
							disabled={isCropping}
							icon={<ArrowDownOutlined />}
							aria-label="图层上移"
							onClick={() => canvasRef?.handler.bringForward()}
						/>
					</Flex>
				</Flex>
			</Flex.Item>
			<div className="rde-canvas-list-items">
				{objects.map(obj => {
					const { title } = resolveListItem(obj);
					const iconType = obj.superType === 'text' ? 'textbox' : obj.type;
					const className =
						selectedItem?.id === obj.id ? 'rde-canvas-list-item selected-item' : 'rde-canvas-list-item';

					return (
						<Flex.Item
							key={obj.id}
							className={className}
							flex="1"
							style={{ cursor: 'pointer' }}
							onClick={() => canvasRef?.handler.select(obj as any)}
							onMouseDown={(event: React.MouseEvent) => event.preventDefault()}
							onDoubleClick={() => canvasRef?.handler.zoomHandler.zoomToCenter()}
						>
							<Flex alignItems="center">
								<ImageMapObjectIcon
									className="rde-canvas-list-item-icon"
									type={iconType}
									style={{ width: 32 }}
								/>
								<div className="rde-canvas-list-item-text">{title}</div>
								<Flex className="rde-canvas-list-item-actions" flex="0 0 auto" justifyContent="flex-end">
									<Tooltip title={obj.visible === false ? '显示图层' : '隐藏图层'}>
										<Button
											className={`rde-action-btn rde-layer-state-btn${obj.visible === false ? '' : ' is-active'}`}
											type="text"
											shape="circle"
											disabled={isCropping}
											icon={obj.visible === false ? <EyeInvisibleOutlined /> : <EyeOutlined />}
											aria-label={`${obj.visible === false ? '显示' : '隐藏'} ${title}`}
											aria-pressed={obj.visible !== false}
											onClick={event => {
												event.stopPropagation();
												updateLayer(obj, { visible: obj.visible === false });
											}}
										/>
									</Tooltip>
									<Tooltip title={obj.locked ? '解锁图层' : '锁定图层'}>
										<Button
											className={`rde-action-btn rde-layer-state-btn${obj.locked ? ' is-active' : ''}`}
											type="text"
											shape="circle"
											disabled={isCropping}
											icon={obj.locked ? <LockOutlined /> : <UnlockOutlined />}
											aria-label={`${obj.locked ? '解锁' : '锁定'} ${title}`}
											aria-pressed={Boolean(obj.locked)}
											onClick={event => {
												event.stopPropagation();
												const locked = !obj.locked;
												const isTextObject = obj.superType === 'text' || obj.type === 'textbox';
												updateLayer(obj, {
													lockMovementX: locked,
													lockMovementY: locked,
													hasControls: !locked && !isTextObject,
													lockScalingX: isTextObject,
													lockScalingY: isTextObject,
													hoverCursor: locked ? 'pointer' : 'move',
													editable: !locked,
													locked,
												});
											}}
										/>
									</Tooltip>
									<Button
										className="rde-action-btn is-secondary"
										shape="circle"
										disabled={isCropping}
										icon={<CopyOutlined />}
										aria-label={`复制 ${title}`}
										onClick={event => {
											event.stopPropagation();
											canvasRef?.handler.duplicateById(obj.id as string);
										}}
									/>
									<Button
										className="rde-action-btn"
										shape="circle"
										danger
										disabled={isCropping}
										icon={<DeleteOutlined />}
										aria-label={`删除 ${title}`}
										onClick={event => {
											event.stopPropagation();
											canvasRef?.handler.removeById(obj.id as string);
										}}
									/>
								</Flex>
							</Flex>
						</Flex.Item>
					);
				})}
			</div>
		</Flex>
	);
}
