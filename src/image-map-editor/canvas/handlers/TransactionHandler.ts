import * as fabric from 'fabric';
import { throttle } from 'lodash-es';
import { FabricObject } from '../models';
import AbstractHandler from './AbstractHandler';
import Handler from './Handler';

export type TransactionType =
	| 'add'
	| 'remove'
	| 'modified'
	| 'moved'
	| 'scaled'
	| 'rotated'
	| 'skewed'
	| 'group'
	| 'ungroup'
	| 'duplicate'
	| 'paste'
	| 'bringForward'
	| 'bringToFront'
	| 'sendBackwards'
	| 'sendToBack'
	| 'redo'
	| 'undo';

export interface TransactionTransform {
	scaleX?: number;
	scaleY?: number;
	skewX?: number;
	skewY?: number;
	angle?: number;
	left?: number;
	top?: number;
	flipX?: number;
	flipY?: number;
	originX?: string;
	originY?: string;
}

export interface TransactionEvent {
	json: string;
	type: TransactionType;
}

class TransactionHandler extends AbstractHandler {
	private readonly MAX_HISTORY_SIZE = 30;

	private currentObjects: FabricObject[] = [];
	private selectedObjectIds: string[] = [];
	redos: TransactionEvent[];
	undos: TransactionEvent[];
	active: boolean = false;

	constructor(handler: Handler) {
		super(handler);
		this.initialize();
	}

	/**
	 * Initialize transaction handler
	 */
	protected initialize = () => {
		this.redos = [];
		this.undos = [];
		this.currentObjects = [];
		this.selectedObjectIds = [];
		this.active = false;
	};

	private sortObjects = (objects: FabricObject[]) => {
		return (objects || []).filter(obj => obj.id !== 'workarea');
	};

	public setDefaultObjects = (objects = this.createSnapshot()) => {
		this.undos = [];
		this.redos = [];
		this.selectedObjectIds = [];

		const normalized = this.sortObjects(objects);

		this.currentObjects = normalized;
	};

	private getSelectionIds = (target?: FabricObject | null) => {
		if (!target) {
			return [];
		}
		if (typeof target.isType === 'function' && target.isType('ActiveSelection')) {
			return (target as fabric.ActiveSelection)
				.getObjects()
				.map(object => (object as FabricObject).id)
				.filter((id): id is string => Boolean(id));
		}
		return target.id ? [target.id] : [];
	};

	public rememberSelection = (target?: FabricObject | null) => {
		if (!this.active) {
			this.selectedObjectIds = this.getSelectionIds(target);
		}
	};

	private serializeObjectInCanvasPlane = (object: fabric.FabricObject) => {
		const originalTransform = fabric.util.saveObjectTransform(object);
		const canvasTransform = object.calcTransformMatrix();

		try {
			fabric.util.applyTransformToObject(object, canvasTransform);
			return object.toObject(this.handler.propertiesToInclude) as FabricObject;
		} finally {
			object.set(originalTransform);
			object.setCoords();
		}
	};

	private createSnapshot = () => {
		const objects = this.handler.canvas.toObject(this.handler.propertiesToInclude).objects as FabricObject[];
		const activeObject = this.handler.canvas.getActiveObject();
		if (!activeObject || typeof activeObject.isType !== 'function' || !activeObject.isType('ActiveSelection')) {
			return objects;
		}

		const activeSelectionObjects = new Set((activeObject as fabric.ActiveSelection).getObjects());
		const exportedObjects = this.handler.canvas
			.getObjects()
			.filter((object: fabric.FabricObject) => !object.excludeFromExport);

		return objects.map((object, index) => {
				const canvasObject = exportedObjects[index];
				return canvasObject && activeSelectionObjects.has(canvasObject)
					? this.serializeObjectInCanvasPlane(canvasObject)
					: object;
			});
	};

	/** Deep clone helper (avoid reference sharing across snapshots). */
	private cloneDeep<T>(v: T): T {
		// eslint-disable-next-line no-undef
		if (typeof structuredClone === 'function') return structuredClone(v);
		return JSON.parse(JSON.stringify(v));
	}

	/**
	 * Save transaction
	 */
	public save = (type: TransactionType) => {
		if (!this.handler.canvasActions.transaction) return;

		try {
			// Always read fresh canvas state first.
			const objects = this.createSnapshot();
			const normalized = this.sortObjects(objects);

			// Normal transactions go into history and invalidate redo.
			const prevJson = JSON.stringify(this.currentObjects);
			this.redos = [];

			this.undos.push({ type, json: prevJson });
			if (this.undos.length > this.MAX_HISTORY_SIZE) {
				this.undos.shift();
			}

			// Update current snapshot
			this.currentObjects = normalized;
		} catch (error) {
			console.error(error);
		}
	};

	/**
	 * Undo transaction
	 */
	public undo = throttle(async () => {
		if (this.active) return;
		const undo = this.undos.pop();
		if (!undo) return;
		const redo = {
			type: 'redo',
			json: JSON.stringify(this.currentObjects),
		} as TransactionEvent;
		this.redos.push(redo);

		try {
			await this.replay(undo);
		} catch (error) {
			if (this.redos[this.redos.length - 1] === redo) {
				this.redos.pop();
			}
			this.undos.push(undo);
			console.error('[TransactionHandler] Undo failed:', error);
		}
	}, 100);

	/**
	 * Redo transaction
	 */
	public redo = throttle(async () => {
		if (this.active) return;
		const redo = this.redos.pop();
		if (!redo) return;
		const undo = {
			type: 'undo',
			json: JSON.stringify(this.currentObjects),
		} as TransactionEvent;
		this.undos.push(undo);

		try {
			await this.replay(redo);
		} catch (error) {
			if (this.undos[this.undos.length - 1] === undo) {
				this.undos.pop();
			}
			this.redos.push(redo);
			console.error('[TransactionHandler] Redo failed:', error);
		}
	}, 100);

	private restoreSnapshot = async (
		objects: FabricObject[],
		activeObjectIds: string[] = [],
		beforeMutation?: () => void,
	) => {
		const restoredFabricObjects = (await fabric.util.enlivenObjects(objects)) as FabricObject[];

		beforeMutation?.();
		this.handler.runBatch(() => {
			this.handler.clear();
			this.handler.canvas.discardActiveObject();
			if (restoredFabricObjects.length) {
				this.handler.canvas.add(...restoredFabricObjects);
			}
			restoredFabricObjects.forEach(object => {
				this.handler.bindObjectEvents(object);
			});

			this.handler.objects = restoredFabricObjects.filter(object => object.id);
			this.handler.objectMap = this.handler.objects.reduce(
				(map, object) => Object.assign(map, { [object.id]: object }),
				{},
			);
		});

		const selectedObjects = activeObjectIds
			.map(id => this.handler.objects.find(object => object.id === id))
			.filter((object): object is FabricObject => Boolean(object));
		if (selectedObjects.length === 1) {
			this.handler.canvas.setActiveObject(selectedObjects[0]);
		} else if (selectedObjects.length > 1) {
			this.handler.canvas.setActiveObject(
				new fabric.ActiveSelection(selectedObjects, {
					canvas: this.handler.canvas,
					...this.handler.activeSelectionOption,
				}),
			);
		}
	};

	/**
	 * Replay transaction
	 *
	 * @param {TransactionEvent} transaction
	 */
	public replay = async (transaction: TransactionEvent) => {
		const fallbackObjects = this.cloneDeep(this.currentObjects);
		const activeObjectIds = this.getSelectionIds(
			this.handler.canvas.getActiveObject() as FabricObject | undefined,
		);
		const selectedObjectIds = activeObjectIds.length ? activeObjectIds : this.selectedObjectIds;
		const interactionState = {
			selection: this.handler.canvas.selection,
			skipTargetFind: this.handler.canvas.skipTargetFind,
		};
		let canvasMutated = false;
		this.active = true;
		this.handler.canvas.selection = false;
		this.handler.canvas.skipTargetFind = true;

		try {
			const parsed = JSON.parse(transaction.json) as FabricObject[];
			const normalized = parsed;
			if (selectedObjectIds.length) {
				this.selectedObjectIds = selectedObjectIds;
			}

			await this.restoreSnapshot(normalized, selectedObjectIds, () => {
				canvasMutated = true;
			});

			this.currentObjects = normalized;
			this.handler.onTransaction?.(transaction);
		} catch (error) {
			let rollbackSucceeded = !canvasMutated;
			if (canvasMutated) {
				try {
					const rollbackObjects = this.cloneDeep(fallbackObjects);
					await this.restoreSnapshot(rollbackObjects, selectedObjectIds);
					rollbackSucceeded = true;
				} catch (rollbackError) {
					console.error('[TransactionHandler] Rollback failed:', rollbackError);
				}
			}
			this.currentObjects = rollbackSucceeded
				? fallbackObjects
				: this.sortObjects(this.createSnapshot());
			throw error;
		} finally {
			this.handler.canvas.selection = interactionState.selection;
			this.handler.canvas.skipTargetFind = interactionState.skipTargetFind;
			this.active = false;
		}
	};

	public canUndo = () => this.undos.length > 0;
	public canRedo = () => this.redos.length > 0;
}

export default TransactionHandler;
