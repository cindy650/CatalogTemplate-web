import { ArrowDownOutlined, ArrowUpOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import React from 'react';

import type { CanvasInstance } from '../../canvas';
import { Flex } from '../../components/flex';
import ImageMapObjectIcon from './ImageMapObjectIcon';

type CanvasListObject = {
	id?: string;
	name?: string;
	superType?: string;
	type?: string;
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
