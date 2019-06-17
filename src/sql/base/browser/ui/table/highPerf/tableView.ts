/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./table';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { Event } from 'vs/base/common/event';
import { ScrollEvent, ScrollbarVisibility, INewScrollDimensions } from 'vs/base/common/scrollable';
import * as DOM from 'vs/base/browser/dom';
import { domEvent } from 'vs/base/browser/event';
import { Delayer, CancelablePromise, createCancelablePromise } from 'vs/base/common/async';
import { isWindows } from 'vs/base/common/platform';
import * as browser from 'vs/base/browser/browser';
import { Range, IRange } from 'vs/base/common/range';
import { getOrDefault } from 'vs/base/common/objects';
import { CellCache, ICell } from 'sql/base/browser/ui/table/highPerf/cellCache';
import { IColumnRenderer, ITableDataSource } from 'sql/base/browser/ui/table/highPerf/table';

export interface IAriaSetProvider<T> {
	getSetSize(element: T, index: number, listLength: number): number;
	getPosInSet(element: T, index: number): number;
}

export interface ITableViewOptions<T> {
	rowHeight?: number;

}

const DefaultOptions = {
	rowHeight: 22,
	columnWidth: 120
};

export interface IColumn<T, TTemplateData> {
	renderer: IColumnRenderer<T, TTemplateData>;
	width?: number;
	id: string;
}

function removeFromParent(element: HTMLElement): void {
	try {
		if (element.parentElement) {
			element.parentElement.removeChild(element);
		}
	} catch (e) {
		// this will throw if this happens due to a blur event, nasty business
	}
}

interface IAsyncRowItem<T> {
	readonly id: string;
	element: T;
	row: HTMLElement | null;
	cells: ICell[] | null;
	size: number;
	datapromise: CancelablePromise<void> | null;
}

export class AsyncTableView<T> implements IDisposable {
	private static InstanceCount = 0;
	readonly domId = `table_id_${++AsyncTableView.InstanceCount}`;

	readonly domNode = document.createElement('div');

	private visibleRows: IAsyncRowItem<T>[] = [];
	private cache: CellCache<T>;
	private renderers = new Map<string, IColumnRenderer<T /* TODO@joao */, any>>();
	private lastRenderTop = 0;
	private lastRenderHeight = 0;
	private renderWidth = 0;
	private readonly rowsContainer = document.createElement('div');
	private scrollableElement: ScrollableElement;
	private _scrollHeight: number;
	private scrollableElementUpdateDisposable: IDisposable | null = null;
	private scrollableElementWidthDelayer = new Delayer<void>(50);
	private ariaSetProvider: IAriaSetProvider<T>;
	private scrollWidth: number | undefined;
	private canUseTranslate3d: boolean | undefined = undefined;
	private rowHeight: number;
	private _length: number = 0;

	private disposables: IDisposable[];

	get contentHeight(): number { return this.length * this.rowHeight; }

	get onDidScroll(): Event<ScrollEvent> { return this.scrollableElement.onScroll; }

	constructor(
		container: HTMLElement,
		private columns: IColumn<T, any>[],
		private dataSource: ITableDataSource<T>,
		options: ITableViewOptions<T> = DefaultOptions as ITableViewOptions<T>,
	) {
		for (const column of columns) {
			this.renderers.set(column.id, column.renderer);
		}

		this.cache = new CellCache(this.renderers);

		this.domNode.className = 'monaco-perftable';

		DOM.addClass(this.domNode, this.domId);
		this.domNode.tabIndex = 0;

		this.ariaSetProvider = { getSetSize: (e, i, length) => length, getPosInSet: (_, index) => index + 1 };

		this.rowHeight = getOrDefault(options, (o) => o.rowHeight, DefaultOptions.rowHeight);
		this.columns = this.columns.map(c => {
			c.width = c.width || DefaultOptions.columnWidth;
			return c;
		});

		this.rowsContainer.className = 'monaco-perftable-rows';

		this.scrollableElement = new ScrollableElement(this.rowsContainer, {
			alwaysConsumeMouseWheel: true,
			horizontal: ScrollbarVisibility.Auto,
			vertical: ScrollbarVisibility.Auto,
			useShadows: true
		});

		this.domNode.appendChild(this.scrollableElement.getDomNode());
		container.appendChild(this.domNode);

		this.disposables = [/*this.gesture,*/ this.scrollableElement, this.cache];

		this.scrollableElement.onScroll(this.onScroll, this, this.disposables);

		// Prevent the monaco-scrollable-element from scrolling
		// https://github.com/Microsoft/vscode/issues/44181
		domEvent(this.scrollableElement.getDomNode(), 'scroll')
			(e => (e.target as HTMLElement).scrollTop = 0, null, this.disposables);

		this.layout();
	}

	private eventuallyUpdateScrollDimensions(): void {
		this._scrollHeight = this.contentHeight;
		this.rowsContainer.style.height = `${this._scrollHeight}px`;

		if (!this.scrollableElementUpdateDisposable) {
			this.scrollableElementUpdateDisposable = DOM.scheduleAtNextAnimationFrame(() => {
				this.scrollableElement.setScrollDimensions({ scrollHeight: this.scrollHeight });
				this.updateScrollWidth();
				this.scrollableElementUpdateDisposable = null;
			});
		}
	}

	private eventuallyUpdateScrollWidth(): void {
		this.scrollableElementWidthDelayer.trigger(() => this.updateScrollWidth());
	}

	private updateScrollWidth(): void {
		this.scrollWidth = this.columns.reduce((p, c) => p + c.width!, 0);
		this.scrollableElement.setScrollDimensions({ scrollWidth: this.scrollWidth + 10 });
	}

	private onScroll(e: ScrollEvent): void {
		try {
			this.render(e.scrollTop, e.height, e.scrollLeft, e.scrollWidth);
		} catch (err) {
			console.error('Got bad scroll event:', e);
			throw err;
		}
	}

	private getRenderRange(renderTop: number, renderHeight: number): IRange {
		const start = Math.floor(renderTop / this.rowHeight);
		const end = Math.min(Math.ceil((renderTop + renderHeight) / this.rowHeight), this.length);
		return {
			start,
			end
		};
	}

	private getNextToLastElement(ranges: IRange[]): HTMLElement | null {
		const lastRange = ranges[ranges.length - 1];

		if (!lastRange) {
			return null;
		}

		const nextToLastItem = this.visibleRows[lastRange.end];

		if (!nextToLastItem) {
			return null;
		}

		if (!nextToLastItem.row) {
			return null;
		}

		return nextToLastItem.row;
	}

	private render(renderTop: number, renderHeight: number, renderLeft: number, scrollWidth: number): void {
		const previousRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
		const renderRange = this.getRenderRange(renderTop, renderHeight);

		const rangesToInsert = Range.relativeComplement(renderRange, previousRenderRange);
		const rangesToRemove = Range.relativeComplement(previousRenderRange, renderRange);
		const beforeElement = this.getNextToLastElement(rangesToInsert);

		for (const range of rangesToInsert) {
			for (let i = range.start; i < range.end; i++) {
				this.insertRowInDOM(i, beforeElement);
			}
		}

		for (const range of rangesToRemove) {
			for (let i = range.start; i < range.end; i++) {
				this.removeRowFromDOM(i);
			}
		}

		const canUseTranslate3d = !isWindows && !browser.isFirefox && browser.getZoomLevel() === 0;

		if (canUseTranslate3d) {
			const transform = `translate3d(-${renderLeft}px, -${renderTop}px, 0px)`;
			this.rowsContainer.style.transform = transform;
			this.rowsContainer.style.webkitTransform = transform;

			if (canUseTranslate3d !== this.canUseTranslate3d) {
				this.rowsContainer.style.left = '0';
				this.rowsContainer.style.top = '0';
			}
		} else {
			this.rowsContainer.style.left = `-${renderLeft}px`;
			this.rowsContainer.style.top = `-${renderTop}px`;

			if (canUseTranslate3d !== this.canUseTranslate3d) {
				this.rowsContainer.style.transform = '';
				this.rowsContainer.style.webkitTransform = '';
			}
		}

		this.rowsContainer.style.width = `${Math.max(scrollWidth, this.renderWidth)}px`;

		this.canUseTranslate3d = canUseTranslate3d;

		this.lastRenderTop = renderTop;
		this.lastRenderHeight = renderHeight;
	}

	public layout(height?: number, width?: number): void {
		const scrollDimensions: INewScrollDimensions = {
			height: typeof height === 'number' ? height : DOM.getContentHeight(this.domNode)
		};

		if (this.scrollableElementUpdateDisposable) {
			this.scrollableElementUpdateDisposable.dispose();
			this.scrollableElementUpdateDisposable = null;
			scrollDimensions.scrollHeight = this.scrollHeight;
		}

		this.scrollableElement.setScrollDimensions(scrollDimensions);

		if (typeof width !== 'undefined') {
			this.renderWidth = width;

			this.scrollableElement.setScrollDimensions({
				width: typeof width === 'number' ? width : DOM.getContentWidth(this.domNode)
			});
		}
	}

	getScrollTop(): number {
		const scrollPosition = this.scrollableElement.getScrollPosition();
		return scrollPosition.scrollTop;
	}

	setScrollTop(scrollTop: number): void {
		if (this.scrollableElementUpdateDisposable) {
			this.scrollableElementUpdateDisposable.dispose();
			this.scrollableElementUpdateDisposable = null;
			this.scrollableElement.setScrollDimensions({ scrollHeight: this.scrollHeight });
		}

		this.scrollableElement.setScrollPosition({ scrollTop });
	}

	get scrollTop(): number {
		return this.getScrollTop();
	}

	set scrollTop(scrollTop: number) {
		this.setScrollTop(scrollTop);
	}

	get scrollHeight(): number {
		return this._scrollHeight + 10;
	}

	private insertRowInDOM(index: number, beforeElement: HTMLElement | null): void {
		let row = this.visibleRows[index];
		// need to check if row doesn't exist

		if (!row) {
			row = {
				id: String(index),
				element: null,
				row: null,
				size: this.rowHeight,
				cells: null,
				datapromise: null
			};
			row.datapromise = createCancelablePromise(token => {
				return this.dataSource.getRow(index).then(d => {
					row.element = d;
				});
			});
			row.datapromise.finally(() => row.datapromise = null);
			this.visibleRows[index] = row;
		}

		if (!row.row) {
			this.allocRow(row);
			row.row!.setAttribute('role', 'treeitem');
		}

		if (!row.row!.parentElement) {
			if (beforeElement) {
				this.rowsContainer.insertBefore(row.row!, beforeElement);
			} else {
				this.rowsContainer.appendChild(row.row!);
			}
		}

		this.updateRowInDOM(row, index);

		if (row.datapromise) {
			row.datapromise.then(() => this.renderRow(row, index));
		} else {
			this.renderRow(row, index);
		}
	}

	private allocRow(row: IAsyncRowItem<T>): void {
		row.cells = new Array<ICell>();
		row.row = DOM.$('.monaco-perftable-row');
		for (const [index, column] of this.columns.entries()) {
			row.cells[index] = this.cache.alloc(column.id);
			row.row.appendChild(row.cells[index].domNode);
		}
	}

	private renderRow(row: IAsyncRowItem<T>, index: number): void {
		for (const [i, column] of this.columns.entries()) {
			const cell = row.cells[i];
			column.renderer.renderElement(row.element, index, cell.templateData, column.width);
		}
	}

	private updateRowInDOM(row: IAsyncRowItem<T>, index: number): void {
		row.row!.style.top = `${this.elementTop(index)}px`;
		row.row!.style.height = `${row.size}px`;

		for (const [index, column] of this.columns.entries()) {
			row.cells[index].domNode.style.width = `${column.width}px`;
		}

		row.row!.setAttribute('data-index', `${index}`);
		row.row!.setAttribute('data-last-element', index === this.length - 1 ? 'true' : 'false');
		row.row!.setAttribute('aria-setsize', String(this.ariaSetProvider.getSetSize(row.element, index, this.length)));
		row.row!.setAttribute('aria-posinset', String(this.ariaSetProvider.getPosInSet(row.element, index)));
		row.row!.setAttribute('id', this.getElementDomId(index));
	}

	private removeRowFromDOM(index: number): void {
		const item = this.visibleRows[index];

		if (item.datapromise) {
			item.datapromise.cancel();
		}

		for (const [i, column] of this.columns.entries()) {
			const renderer = column.renderer;
			const cell = item.cells[i];
			if (renderer && renderer.disposeElement) {
				renderer.disposeElement(item.element, index, cell.templateData, column.width);
			}

			this.cache.release(cell!);
		}

		removeFromParent(item.row);

		delete this.visibleRows[index];
	}

	elementTop(index: number): number {
		return Math.floor(index * this.rowHeight);
	}

	getElementDomId(index: number): string {
		return `${this.domId}_${index}`;
	}

	get length(): number {
		return this._length;
	}

	set length(length: number) {
		this._length = length;
		this.eventuallyUpdateScrollDimensions();
	}

	dispose(): void {
		dispose(this.disposables);
	}
}