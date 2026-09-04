import {
	CopyOutlined,
	DeleteOutlined,
	EditOutlined,
	FileTextOutlined,
	PlusOutlined,
	ReloadOutlined,
	SaveOutlined,
	SyncOutlined,
	UploadOutlined,
} from '@ant-design/icons';
import { App, Button, Checkbox, Col, Empty, Form, Image, Input, Modal, Popconfirm, Row, Segmented, Select, Spin, Tag, Tooltip, Upload } from 'antd';
import React from 'react';

import { EditorPanelHeader } from '../../components/editor';
import type { ImageMapShopOption, ImageMapShopValue } from './ImageMapBasicInfo';

export interface ImageMapFontLayoutSizeOption {
	id: string;
	label: string;
}

export interface ImageMapFontLayoutSizeOptionStatus {
	sizeOptionId: string;
	label?: string;
	hasSizeVariant?: boolean;
	layersSource?: 'size_template_option' | 'size_variant' | 'base';
	usingBaseLayers?: boolean;
	message?: string;
}

export interface ImageMapFontLayoutOption {
	id: string | number;
	name: string;
	category?: string;
	productId?: ImageMapShopValue;
	previewImage?: string;
	layerCount: number;
	layers: ImageMapFontLayoutLayerData;
}

export interface ImageMapFontLayoutLayerData {
	objects: Record<string, unknown>[];
	animations: Record<string, unknown>[];
	styles: Record<string, unknown>[];
	dataSources: Record<string, unknown>[];
}

export type ImageMapFontLayoutLoader = (
	shopId: ImageMapShopValue,
	productId?: ImageMapShopValue,
) => Promise<ImageMapFontLayoutOption[]>;

export interface ImageMapFontLayoutCategoryOption {
	label: string;
	value: ImageMapShopValue;
}

export type ImageMapFontLayoutCategoryLoader = (
	shopId: ImageMapShopValue,
) => Promise<ImageMapFontLayoutCategoryOption[]>;

export type ImageMapFontLayoutProductLoader = ImageMapFontLayoutCategoryLoader;

export type ImageMapFontLayoutCreator = (
	shopId: ImageMapShopValue,
	name: string,
	previewFile?: File,
	layers?: ImageMapFontLayoutLayerData,
	productId?: ImageMapShopValue,
) => Promise<void>;

export type ImageMapFontLayoutDeleter = (
	layoutId: ImageMapFontLayoutOption['id'],
) => Promise<void>;

export type ImageMapFontLayoutSaver = (
	layoutId: ImageMapFontLayoutOption['id'],
	layers: ImageMapFontLayoutLayerData,
) => Promise<void>;

export type ImageMapFontLayoutUpdater = (
	layoutId: ImageMapFontLayoutOption['id'],
	shopId: ImageMapShopValue,
	name: string,
	previewFile?: File,
	productId?: ImageMapShopValue,
) => Promise<void>;

export type ImageMapFontLayoutSizeOptionLoader = (
	layoutId: ImageMapFontLayoutOption['id'],
	sizeTemplateId: number,
) => Promise<ImageMapFontLayoutSizeOptionStatus[]>;

export type ImageMapFontLayoutSizeLoader = (
	layoutId: ImageMapFontLayoutOption['id'],
	sizeTemplateId: number,
	sizeOptionId: string,
) => Promise<ImageMapFontLayoutSizeLoadResult>;

export interface ImageMapFontLayoutSizeLoadResult {
	layers: ImageMapFontLayoutLayerData;
	layersSource?: 'size_template_option' | 'size_variant' | 'base';
	usingBaseLayers?: boolean;
	message?: string;
}

export type ImageMapFontLayoutSizeOptionSyncer = (
	layoutId: ImageMapFontLayoutOption['id'],
	sizeTemplateId: number,
	items: Array<{ sizeOptionId: string; layers: ImageMapFontLayoutLayerData }>,
) => Promise<{ syncedCount?: number; justSyncedSizeOptionIds: string[]; missingSizeOptionIds: string[]; message?: string }>;

interface ImageMapFontLayoutsProps {
	createFontLayout?: ImageMapFontLayoutCreator;
	createEmptyCanvasLayers?: (canvasRows: 1 | 2) => ImageMapFontLayoutLayerData;
	defaultShopId?: ImageMapShopValue;
	defaultProductId?: ImageMapShopValue;
	deleteFontLayout?: ImageMapFontLayoutDeleter;
	getCanvasLayers?: () => ImageMapFontLayoutLayerData;
	loadFontLayoutCategories?: ImageMapFontLayoutCategoryLoader;
	loadFontLayoutProducts?: ImageMapFontLayoutProductLoader;
	loadFontLayouts?: ImageMapFontLayoutLoader;
	loadFontLayoutSizeOptions?: ImageMapFontLayoutSizeOptionLoader;
	onSelectFontLayout?: (layout: ImageMapFontLayoutOption) => void | Promise<void>;
	saveFontLayout?: ImageMapFontLayoutSaver;
	sizeOptions?: ImageMapFontLayoutSizeOption[];
	sizeTemplateId?: number;
	syncFontLayoutSizeOptions?: ImageMapFontLayoutSizeOptionSyncer;
	shops: ImageMapShopOption[];
	updateFontLayout?: ImageMapFontLayoutUpdater;
}

const ImageMapFontLayouts = ({
	createFontLayout,
	createEmptyCanvasLayers,
	defaultShopId,
	defaultProductId,
	deleteFontLayout,
	getCanvasLayers,
	loadFontLayoutCategories,
	loadFontLayoutProducts,
	loadFontLayouts,
	loadFontLayoutSizeOptions,
	onSelectFontLayout,
	saveFontLayout,
	shops,
	sizeOptions = [],
	sizeTemplateId,
	syncFontLayoutSizeOptions,
	updateFontLayout,
}: ImageMapFontLayoutsProps) => {
	const { message } = App.useApp();
		const [selectedShopId, setSelectedShopId] = React.useState<ImageMapShopValue | undefined>(
			defaultShopId ?? shops[0]?.value,
		);
		const [selectedProductId, setSelectedProductId] = React.useState<ImageMapShopValue | undefined>(defaultProductId);
		const [productOptions, setProductOptions] = React.useState<ImageMapFontLayoutCategoryOption[]>([]);
		const [productLoading, setProductLoading] = React.useState(false);
	const [layouts, setLayouts] = React.useState<ImageMapFontLayoutOption[]>([]);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState('');
	const [operationError, setOperationError] = React.useState('');
	const [createOpen, setCreateOpen] = React.useState(false);
	const [createMode, setCreateMode] = React.useState<'create' | 'edit' | 'saveAs'>('create');
	const [editingLayoutId, setEditingLayoutId] = React.useState<ImageMapFontLayoutOption['id']>();
	const [createName, setCreateName] = React.useState('');
	const [createCategory, setCreateCategory] = React.useState<ImageMapShopValue>();
	const [createCanvasRows, setCreateCanvasRows] = React.useState<1 | 2>(1);
	const [categoryOptions, setCategoryOptions] = React.useState<ImageMapFontLayoutCategoryOption[]>([]);
	const [categoryLoading, setCategoryLoading] = React.useState(false);
	const [createShopId, setCreateShopId] = React.useState<ImageMapShopValue | undefined>();
	const [createPreviewFile, setCreatePreviewFile] = React.useState<File>();
	const [creating, setCreating] = React.useState(false);
	const [deletingId, setDeletingId] = React.useState<ImageMapFontLayoutOption['id']>();
	const [selectedLayoutId, setSelectedLayoutId] = React.useState<ImageMapFontLayoutOption['id']>();
	const [saving, setSaving] = React.useState(false);
	const [syncOpen, setSyncOpen] = React.useState(false);
	const [syncLoading, setSyncLoading] = React.useState(false);
	const [syncing, setSyncing] = React.useState(false);
	const [syncStatuses, setSyncStatuses] = React.useState<ImageMapFontLayoutSizeOptionStatus[]>([]);
	const [syncSelectedIds, setSyncSelectedIds] = React.useState<string[]>([]);
	const requestIdRef = React.useRef(0);
	const layoutsCacheRef = React.useRef(new Map<string, ImageMapFontLayoutOption[]>());
	const loadFontLayoutsRef = React.useRef(loadFontLayouts);
	loadFontLayoutsRef.current = loadFontLayouts;
	const selectedLayout = layouts.find(layout => layout.id === selectedLayoutId);
	const editingLayout = layouts.find(layout => layout.id === editingLayoutId);
	const canvasRowsFromLayers = React.useCallback((layers?: ImageMapFontLayoutLayerData): 1 | 2 => (
		layers?.objects.find(object => object.id === 'workarea')?.canvasRows === 2 ? 2 : 1
	), []);

	React.useEffect(() => {
		setSelectedShopId(current => {
			if (defaultShopId !== undefined) {
				return defaultShopId;
			}
			return shops.some(shop => shop.value === current) ? current : shops[0]?.value;
		});
	}, [defaultShopId, shops]);

	React.useEffect(() => {
		if (defaultProductId !== undefined) {
			setSelectedProductId(defaultProductId);
		}
	}, [defaultProductId]);

	React.useEffect(() => {
		if (selectedShopId === undefined || !loadFontLayoutProducts) {
			setProductOptions([]);
			return;
		}
		let cancelled = false;
		setProductLoading(true);
		void loadFontLayoutProducts(selectedShopId).then(options => {
			if (cancelled) return;
			setProductOptions(options);
			setSelectedProductId(current => (
				current !== undefined && options.some(option => option.value === current)
					? current
					: defaultProductId !== undefined && options.some(option => option.value === defaultProductId)
						? defaultProductId
						: options[0]?.value
			));
		}).catch(() => {
			if (!cancelled) setProductOptions([]);
		}).finally(() => {
			if (!cancelled) setProductLoading(false);
		});
		return () => { cancelled = true; };
	}, [defaultProductId, loadFontLayoutProducts, selectedShopId]);

	const reload = React.useCallback(async (force = false) => {
		const requestId = ++requestIdRef.current;
		const loader = loadFontLayoutsRef.current;
		if (selectedShopId === undefined || !loader || (loadFontLayoutProducts && selectedProductId === undefined)) {
			setLayouts([]);
			setError(loader ? '' : '未配置字体布局数据源');
			setLoading(false);
			return;
		}
		const cacheKey = `${String(selectedShopId)}:${selectedProductId === undefined ? '' : String(selectedProductId)}`;
		const cachedLayouts = layoutsCacheRef.current.get(cacheKey);
		if (!force && cachedLayouts) {
			setLayouts(cachedLayouts);
			setError('');
			setLoading(false);
			return;
		}

		setLoading(true);
		setError('');
		try {
			const nextLayouts = await loader(selectedShopId, selectedProductId);
			if (requestId === requestIdRef.current) {
				layoutsCacheRef.current.set(cacheKey, nextLayouts);
				setLayouts(nextLayouts);
			}
		} catch (loadError) {
			if (requestId === requestIdRef.current) {
				setLayouts([]);
				setError(loadError instanceof Error ? loadError.message : String(loadError));
			}
		} finally {
			if (requestId === requestIdRef.current) {
				setLoading(false);
			}
		}
	}, [selectedProductId, selectedShopId]);

	React.useEffect(() => {
		void reload();
		return () => {
			requestIdRef.current += 1;
		};
	}, [reload]);

	React.useEffect(() => {
		if (!createOpen || createShopId === undefined || !loadFontLayoutCategories) {
			setCategoryOptions([]);
			setCategoryLoading(false);
			return;
		}

		let cancelled = false;
		setCategoryLoading(true);
		setOperationError('');
		void loadFontLayoutCategories(createShopId).then(options => {
			if (!cancelled) setCategoryOptions(options);
		}).catch(loadError => {
			if (!cancelled) {
				setCategoryOptions([]);
				setOperationError(loadError instanceof Error ? loadError.message : String(loadError));
			}
		}).finally(() => {
			if (!cancelled) setCategoryLoading(false);
		});
		return () => { cancelled = true; };
	}, [createOpen, createShopId, loadFontLayoutCategories]);

	const openCreateModal = () => {
		setCreateMode('create');
		setEditingLayoutId(undefined);
		setCreateName('');
		setCreateCategory(undefined);
		setCreateCanvasRows(1);
		setCreateShopId(selectedShopId);
		setCreatePreviewFile(undefined);
		setOperationError('');
		setCreateOpen(true);
	};

	const openSaveAsModal = () => {
		setCreateMode('saveAs');
		setEditingLayoutId(undefined);
		setCreateName(selectedLayout ? `${selectedLayout.name} - 副本` : '布局副本');
		setCreateCategory(selectedLayout?.productId);
		setCreateCanvasRows(canvasRowsFromLayers(getCanvasLayers?.() ?? selectedLayout?.layers));
		setCreateShopId(selectedShopId);
		setCreatePreviewFile(undefined);
		setOperationError('');
		setCreateOpen(true);
	};

	const openEditModal = (layout: ImageMapFontLayoutOption) => {
		setCreateMode('edit');
		setEditingLayoutId(layout.id);
		setCreateName(layout.name);
		setCreateCategory(layout.productId);
		setCreateCanvasRows(canvasRowsFromLayers(layout.layers));
		setCreateShopId(selectedShopId);
		setCreatePreviewFile(undefined);
		setOperationError('');
		setCreateOpen(true);
	};

	const submitCreate = async () => {
		const name = createName.trim();
		const editing = createMode === 'edit';
		if (
			creating
			|| !name
			|| createShopId === undefined
			|| (editing ? !editingLayout || !updateFontLayout : !createFontLayout)
		) {
			return;
		}
		setCreating(true);
		setOperationError('');
		try {
			if (editing && editingLayout) {
				await updateFontLayout?.(editingLayout.id, createShopId, name, createPreviewFile, createCategory);
			} else {
				const layers = createMode === 'saveAs'
					? getCanvasLayers?.()
					: createEmptyCanvasLayers?.(createCanvasRows);
				await createFontLayout?.(
					createShopId,
					name,
					createPreviewFile,
					layers,
					createCategory,
				);
			}
			setCreateOpen(false);
			setCreateName('');
			setCreatePreviewFile(undefined);
			if (createShopId === selectedShopId) {
				await reload(true);
			} else {
		setSelectedShopId(createShopId);
			}
			message.success(editing ? '字体布局已修改' : createMode === 'saveAs' ? '字体布局已另存为' : '字体布局已新增');
		} catch (createError) {
			setOperationError(createError instanceof Error ? createError.message : String(createError));
		} finally {
			setCreating(false);
		}
	};

	const selectLayout = async (layout: ImageMapFontLayoutOption) => {
		setSelectedLayoutId(layout.id);
		setOperationError('');
		try {
			await onSelectFontLayout?.(layout);
		} catch (selectError) {
			setOperationError(selectError instanceof Error ? selectError.message : String(selectError));
		}
	};

	const saveSelectedLayout = async () => {
		if (!selectedLayout || !saveFontLayout || !getCanvasLayers) return;
		setSaving(true);
		setOperationError('');
		try {
			await saveFontLayout(selectedLayout.id, getCanvasLayers());
			await reload(true);
			message.success('字体布局已保存');
		} catch (saveError) {
			setOperationError(saveError instanceof Error ? saveError.message : String(saveError));
		} finally {
			setSaving(false);
		}
	};

	const openSyncModal = () => {
		if (!selectedLayout || sizeTemplateId === undefined || sizeOptions.length === 0) return;
		setOperationError('');
		setSyncSelectedIds(sizeOptions.map(option => option.id));
		setSyncStatuses([]);
		setSyncOpen(true);
		if (!loadFontLayoutSizeOptions) return;
		setSyncLoading(true);
		void loadFontLayoutSizeOptions(selectedLayout.id, sizeTemplateId).then(statuses => {
			setSyncStatuses(statuses);
		}).catch(loadError => {
			setOperationError(loadError instanceof Error ? loadError.message : String(loadError));
		}).finally(() => setSyncLoading(false));
	};

	const syncSelectedLayoutSizes = async () => {
		if (!selectedLayout || sizeTemplateId === undefined || !syncFontLayoutSizeOptions || !getCanvasLayers || syncSelectedIds.length === 0) return;
		setSyncing(true);
		setOperationError('');
		try {
			const layers = getCanvasLayers();
			const result = await syncFontLayoutSizeOptions(
				selectedLayout.id,
				sizeTemplateId,
				syncSelectedIds.map(sizeOptionId => ({ sizeOptionId, layers })),
			);
			setSyncOpen(false);
			message.success(result.message || `已同步 ${result.syncedCount ?? syncSelectedIds.length} 个尺寸`);
		} catch (syncError) {
			setOperationError(syncError instanceof Error ? syncError.message : String(syncError));
		} finally {
			setSyncing(false);
		}
	};

	const removeLayout = async (layout: ImageMapFontLayoutOption) => {
		if (!deleteFontLayout) {
			return;
		}
		setDeletingId(layout.id);
		setOperationError('');
		try {
			await deleteFontLayout(layout.id);
			await reload(true);
		} catch (deleteError) {
			setOperationError(deleteError instanceof Error ? deleteError.message : String(deleteError));
		} finally {
			setDeletingId(undefined);
		}
	};

	return (
		<React.Fragment>
			<section className="rde-imagemap-font-layouts">
				<EditorPanelHeader eyebrow="字体" title="字体布局" />
				<div className="rde-imagemap-font-layouts-content">
					<div className="rde-font-layout-summary">
						<div className="rde-font-layout-summary-copy">
							<strong>字体布局</strong>
							<span>{layouts.length} 个布局</span>
						</div>
					</div>
					<div className="rde-font-layout-actions">
						<Button size="small" icon={<PlusOutlined />} disabled={selectedShopId === undefined || !createFontLayout} onClick={openCreateModal}>新增布局</Button>
						<Button size="small" type="primary" ghost icon={<SaveOutlined />} loading={saving} disabled={!selectedLayout || !saveFontLayout || !getCanvasLayers} onClick={() => void saveSelectedLayout()}>保存</Button>
						<Button size="small" icon={<CopyOutlined />} disabled={!selectedLayout || !createFontLayout || !getCanvasLayers} onClick={openSaveAsModal}>另存为</Button>
						<Button size="small" icon={<SyncOutlined />} disabled={!selectedLayout || sizeTemplateId === undefined || sizeOptions.length === 0 || !syncFontLayoutSizeOptions || !getCanvasLayers} onClick={openSyncModal}>同步尺寸</Button>
					</div>
					<div className="rde-font-layout-shop-field">
						<span>所属产品</span>
						<Select
							showSearch
							optionFilterProp="label"
							aria-label="字体布局所属产品"
							placeholder="选择产品"
							value={selectedProductId}
							options={productOptions}
							loading={productLoading}
							onChange={value => {
								setSelectedProductId(value);
								setSelectedLayoutId(undefined);
							}}
						/>
					</div>
					<div className="rde-font-layout-shop-field">
						<span>所属店铺</span>
						<Select
							showSearch
							optionFilterProp="label"
							aria-label="字体布局所属店铺"
							placeholder="选择店铺"
			value={selectedShopId}
			options={shops}
			onChange={value => {
				setSelectedShopId(value);
				setSelectedProductId(undefined);
				setSelectedLayoutId(undefined);
			}}
						/>
					</div>
					{operationError && !createOpen ? (
						<div className="rde-font-layout-operation-error">{operationError}</div>
					) : null}
					{loading ? (
						<div className="rde-font-layout-state">
							<Spin size="small" />
							<span>正在加载字体布局</span>
						</div>
					) : error ? (
						<div className="rde-font-layout-state is-error">
							<span>{error}</span>
							<Button size="small" icon={<ReloadOutlined />} onClick={() => void reload(true)}>
								重新加载
							</Button>
						</div>
					) : layouts.length === 0 ? (
						<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前店铺暂无字体布局" />
					) : (
						<div className="rde-font-layout-list" role="listbox" aria-label="字体布局列表">
							{layouts.map(layout => (
								<div className={`rde-font-layout-item${layout.id === selectedLayoutId ? ' is-selected' : ''}`} key={layout.id} role="option" aria-selected={layout.id === selectedLayoutId} tabIndex={0} onClick={() => void selectLayout(layout)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void selectLayout(layout); } }}>
									<div className="rde-font-layout-preview" onClick={layout.previewImage ? event => event.stopPropagation() : undefined}>
										{layout.previewImage ? (
											<Image src={layout.previewImage} alt={`${layout.name || '字体布局'}预览图`} preview={{ src: layout.previewImage }} />
										) : (
											<FileTextOutlined />
										)}
									</div>
									<div className="rde-font-layout-copy">
										<strong>{layout.name || '未命名字体布局'}</strong>
										<span>
											{layout.category ? `${layout.category} · ` : ''}{layout.layerCount} 个图层
										</span>
									</div>
									<Tooltip title="编辑布局">
										<Button type="text" size="small" className="rde-font-layout-edit" icon={<EditOutlined />} disabled={!updateFontLayout} aria-label={`编辑 ${layout.name || '未命名字体布局'}`} onClick={event => { event.stopPropagation(); openEditModal(layout); }} />
									</Tooltip>
									<Popconfirm
										title="删除字体布局"
										description={`确定删除“${layout.name || '未命名字体布局'}”吗？`}
										okText="删除"
										cancelText="取消"
										okButtonProps={{ danger: true }}
										onConfirm={() => removeLayout(layout)}
									>
										<Button
											type="text"
											danger
											size="small"
											className="rde-font-layout-delete"
											icon={<DeleteOutlined />}
											loading={deletingId === layout.id}
											disabled={!deleteFontLayout}
											aria-label={`删除 ${layout.name || '未命名字体布局'}`}
											onClick={event => event.stopPropagation()}
										/>
									</Popconfirm>
								</div>
							))}
						</div>
					)}
				</div>
			</section>
			<Modal
				open={createOpen}
				title={createMode === 'edit' ? '编辑字体布局' : createMode === 'saveAs' ? '另存为字体布局' : '新增字体布局模板'}
				okText="保存"
				cancelText="取消"
				confirmLoading={creating}
				okButtonProps={{ disabled: !createName.trim() || createShopId === undefined }}
				destroyOnHidden
				width={680}
				className="rde-editor-modal rde-font-layout-create-modal"
				onOk={() => void submitCreate()}
				onCancel={() => {
					if (!creating) {
						setCreateOpen(false);
						setCreatePreviewFile(undefined);
						setOperationError('');
					}
				}}
			>
				<Form layout="vertical" colon={false} requiredMark className="rde-font-layout-create-form">
					<Row gutter={10}>
						<Col span={8}>
							<Form.Item label="名称" required>
								<Input
									autoFocus
									disabled={creating}
									value={createName}
									placeholder="例如：封面标题"
									onChange={event => setCreateName(event.target.value)}
									onPressEnter={() => void submitCreate()}
								/>
							</Form.Item>
						</Col>
						<Col span={8}>
							<Form.Item label="分类">
								<Select
									allowClear
									showSearch
									optionFilterProp="label"
									disabled={creating}
									loading={categoryLoading}
									value={createCategory}
									options={categoryOptions}
									placeholder={categoryLoading ? '正在加载产品分类' : '选择产品分类'}
									onChange={setCreateCategory}
								/>
							</Form.Item>
						</Col>
						<Col span={8}>
							<Form.Item label="所属店铺" required>
								<Select
									showSearch
									optionFilterProp="label"
									disabled={creating}
									value={createShopId}
									options={shops}
									placeholder="选择店铺"
									onChange={shopId => {
										setCreateShopId(shopId);
										setCreateCategory(undefined);
									}}
								/>
							</Form.Item>
						</Col>
					</Row>
					<Form.Item label="画布排数" required>
						<Segmented
							block
							disabled={creating || createMode !== 'create'}
							value={createCanvasRows}
							options={[
								{ value: 1, label: '单排' },
								{ value: 2, label: '两排' },
							]}
							onChange={value => setCreateCanvasRows(value === 2 ? 2 : 1)}
						/>
					</Form.Item>
					<div className="rde-font-layout-preview-upload">
						<div className="rde-font-layout-preview-upload-copy">
							<strong>预览图</strong>
							<span>
								{createPreviewFile?.name || (createMode === 'edit' && editingLayout?.previewImage ? '已有预览图，选择图片可替换' : '可选，支持 PNG / JPG / WEBP')}
							</span>
						</div>
						<Upload
							accept="image/png,image/jpeg,image/webp"
							maxCount={1}
							showUploadList={false}
							beforeUpload={file => {
								setCreatePreviewFile(file);
								return false;
							}}
						>
							<Button disabled={creating} icon={<UploadOutlined />}>
								选择图片
							</Button>
						</Upload>
					</div>
					<div className="rde-font-layout-create-hint">
						新建后可从字体布局列表选择，并在画布中继续编辑图层。
					</div>
					{operationError ? (
						<div className="rde-font-layout-operation-error">{operationError}</div>
					) : null}
				</Form>
			</Modal>
			<Modal
				open={syncOpen}
				title="同步尺寸"
				okText="同步"
				cancelText="取消"
				confirmLoading={syncing}
				okButtonProps={{ disabled: syncSelectedIds.length === 0 || syncLoading }}
				destroyOnHidden
				onOk={() => void syncSelectedLayoutSizes()}
				onCancel={() => { if (!syncing) setSyncOpen(false); }}
			>
				<div className="rde-font-layout-sync-options">
					<p>选择要写入当前字体布局的尺寸，未选择的尺寸继续使用基础图层。</p>
					{syncLoading ? <Spin size="small" /> : sizeOptions.map(option => {
						const status = syncStatuses.find(item => item.sizeOptionId === option.id);
						return (
							<div className="rde-font-layout-sync-option" key={option.id}>
								<Checkbox
									checked={syncSelectedIds.includes(option.id)}
									onChange={event => setSyncSelectedIds(current => event.target.checked ? [...current, option.id] : current.filter(id => id !== option.id))}
								>
									<strong>{option.label || option.id}</strong>
								</Checkbox>
								{status?.layersSource ? <Tag color={status.layersSource === 'size_template_option' || status.layersSource === 'size_variant' ? 'blue' : 'default'}>{status.layersSource === 'size_template_option' ? '规格独立图层' : status.layersSource === 'size_variant' ? '专属图层' : '基础图层'}</Tag> : null}
								{status?.message ? <span>{status.message}</span> : null}
							</div>
						);
					})}
				</div>
			</Modal>
		</React.Fragment>
	);
};

export default ImageMapFontLayouts;
