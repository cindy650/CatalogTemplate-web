import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from 'antd';
import { CloseOutlined, FontSizeOutlined, HolderOutlined } from '@ant-design/icons';
import type { CanvasInstance } from '../../canvas';
import { EditorPanelHeader } from '../../components/editor';
import type { ImageMapSizeSchemeValue } from './ImageMapSizeScheme';
import InnerPageMapProperties from './properties/InnerPageMapProperties';
import MapProperties from './properties/MapProperties';

interface ImageMapCanvasSettingsProps {
	canvasRef?: CanvasInstance | null;
	onChange?: (selectedItem: any, changedValues: Record<string, any>, allValues: Record<string, any>) => void;
	sizeSchemes: ImageMapSizeSchemeValue[];
	activeSizeSchemeId: string;
	onAddSizeScheme: () => void;
	onDeleteSizeScheme: (id: string) => void;
	onSaveSizeScheme: (values: Omit<ImageMapSizeSchemeValue, 'id'>) => void;
	onRegisterSaveSizeScheme?: (handler: () => void) => void;
	hideSizeSchemeSaveButton?: boolean;
	onSelectSizeScheme: (id: string) => void;
	innerPageMode?: boolean;
	simplified?: boolean;
	hideCanvasSection?: boolean;
	fontLayoutContent?: ReactNode;
	fontLayoutSelection?: ReactNode;
}

	const ImageMapCanvasSettings = ({
	canvasRef,
	onChange,
	sizeSchemes,
	activeSizeSchemeId,
	onAddSizeScheme,
	onDeleteSizeScheme,
	onSaveSizeScheme,
	onRegisterSaveSizeScheme,
	hideSizeSchemeSaveButton,
	onSelectSizeScheme,
	innerPageMode,
	simplified,
	hideCanvasSection = true,
	fontLayoutContent,
	fontLayoutSelection,
}: ImageMapCanvasSettingsProps) => {
		const settingsRef = useRef<HTMLElement>(null);
		const dragRef = useRef<{ startX: number; startY: number; left: number; top: number }>();
		const [fontLayoutFloating, setFontLayoutFloating] = useState<{ left: number; top: number; width: number }>();
		const [fontLayoutFloatingOpen, setFontLayoutFloatingOpen] = useState(false);

		const openFontLayout = () => {
			const rect = settingsRef.current?.getBoundingClientRect();
			setFontLayoutFloating({ left: rect?.left ?? 8, top: rect?.top ?? 8, width: rect?.width ?? 252 });
			setFontLayoutFloatingOpen(true);
		};

		useEffect(() => {
			const move = (event: PointerEvent) => {
				const drag = dragRef.current;
				if (!drag) return;
				setFontLayoutFloating(current => current ? {
					...current,
					left: Math.max(8, drag.left + event.clientX - drag.startX),
					top: Math.max(8, drag.top + event.clientY - drag.startY),
				} : current);
			};
			const up = () => { dragRef.current = undefined; };
			window.addEventListener('pointermove', move);
			window.addEventListener('pointerup', up);
			return () => {
				window.removeEventListener('pointermove', move);
				window.removeEventListener('pointerup', up);
			};
		}, []);

		const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
			if (!fontLayoutFloating) return;
			event.preventDefault();
			dragRef.current = { startX: event.clientX, startY: event.clientY, left: fontLayoutFloating.left, top: fontLayoutFloating.top };
		};
		const fontLayoutTrigger = fontLayoutContent ? (
			<Button type="primary" icon={<FontSizeOutlined />} className="rde-font-layout-open-button" onClick={openFontLayout}>
				选择/创建布局
			</Button>
		) : null;

		return (
		<section ref={settingsRef} className="rde-imagemap-canvas-settings">
			<EditorPanelHeader eyebrow="规格" title="尺寸方案" />
			<div className="rde-imagemap-canvas-settings-content">
				{innerPageMode ? (
				<InnerPageMapProperties
					canvasRef={canvasRef ?? undefined}
					onChange={onChange}
					sizeSchemes={sizeSchemes}
					activeSizeSchemeId={activeSizeSchemeId}
					onAddSizeScheme={onAddSizeScheme}
					onSelectSizeScheme={onSelectSizeScheme}
					fontLayoutTrigger={fontLayoutTrigger}
					fontLayoutSelection={fontLayoutSelection}
				/>
				) : (
				<MapProperties
					canvasRef={canvasRef ?? undefined}
					onChange={onChange}
					sizeSchemes={sizeSchemes}
					activeSizeSchemeId={activeSizeSchemeId}
					onAddSizeScheme={onAddSizeScheme}
					onDeleteSizeScheme={onDeleteSizeScheme}
					onSaveSizeScheme={onSaveSizeScheme}
					onRegisterSaveSizeScheme={onRegisterSaveSizeScheme}
					hideSizeSchemeSaveButton={hideSizeSchemeSaveButton}
					onSelectSizeScheme={onSelectSizeScheme}
					simplified={simplified}
					hideCanvasSection={hideCanvasSection}
					fontLayoutTrigger={fontLayoutTrigger}
					fontLayoutSelection={fontLayoutSelection}
				/>
				)}
			</div>
			{fontLayoutContent && fontLayoutFloating ? (
				<div className={`rde-imagemap-font-layout-floating${fontLayoutFloatingOpen ? ' is-open' : ' is-closed'}`} style={{ left: fontLayoutFloating.left, top: fontLayoutFloating.top, width: fontLayoutFloating.width }} role="dialog" aria-label="字体布局" aria-hidden={!fontLayoutFloatingOpen}>
					<div className="rde-imagemap-font-layout-floating-header" onPointerDown={startDrag}>
						<span><HolderOutlined /> 字体布局</span>
						<Button type="text" size="small" icon={<CloseOutlined />} aria-label="关闭字体布局" onPointerDown={event => event.stopPropagation()} onClick={() => setFontLayoutFloatingOpen(false)} />
					</div>
					<div className="rde-imagemap-font-layout-floating-body">{fontLayoutContent}</div>
				</div>
			) : null}
		</section>
		);
	};

export default ImageMapCanvasSettings;
