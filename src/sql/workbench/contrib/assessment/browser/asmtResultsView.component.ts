/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/asmt';
import 'vs/css!./media/detailview';

import * as azdata from 'azdata';
import * as dom from 'vs/base/browser/dom';
import { Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, OnInit, OnDestroy, AfterContentChecked } from '@angular/core';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { Table } from 'sql/base/browser/ui/table/table';
import { AsmtViewComponent } from 'sql/workbench/contrib/assessment/browser/asmtView.component';
import { HeaderFilter } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';
import { IAssessmentService } from 'sql/workbench/services/assessment/common/interfaces';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { attachButtonStyler } from 'sql/platform/theme/common/styler';
import { find } from 'vs/base/common/arrays';
import { RowDetailView, ExtendedItem } from 'sql/base/browser/ui/table/plugins/rowDetailView';
import { IAsmtActionInfo, AsmtServerSelectItemsAction, AsmtServerInvokeItemsAction, AsmtDatabaseSelectItemsAction, AsmtDatabaseInvokeItemsAction, AsmtExportAsScriptAction } from 'sql/workbench/contrib/assessment/browser/asmtActions';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { openNewQuery } from 'sql/workbench/contrib/query/browser/queryActions';
import { IAction } from 'vs/base/common/actions';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import * as Utils from 'sql/platform/connection/common/utils';

export const ASMTRESULTSVIEW_SELECTOR: string = 'asmt-results-view-component';
export const ROW_HEIGHT: number = 25;
export const ACTIONBAR_PADDING: number = 10;

const PLACEHOLDER_LABEL = 'Nothing to show. Invoke assessment to get results';
const PLACEHOLDER_NO_RESULTS_LABEL = '<OBJECT_TYPE> <OBJECT_NAME> is totally compliant with the best practices. Good job!';

interface IItem extends Slick.SlickData {
	jobId?: string;
	id: string;
}

@Component({
	selector: ASMTRESULTSVIEW_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./asmtResultsView.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => AsmtResultsViewComponent) }],
})

export class AsmtResultsViewComponent extends TabChild implements OnInit, OnDestroy, AfterContentChecked {
	protected _parentComponent: AsmtViewComponent;
	protected _table: Table<any>;
	protected _visibilityElement: ElementRef;
	protected isVisible: boolean = false;
	protected isInitialized: boolean = false;
	protected isRefreshing: boolean = false;
	protected _showProgressWheel: boolean;
	public contextAction: any;
	private dataView: any;
	private filterPlugin: any;
	protected _actionBar: Taskbar;
	private isServerMode: boolean;
	private columns: Array<Slick.Column<any>> = [
		{ name: 'Severity', field: 'severity', maxWidth: 80, id: 'severity' },
		{
			name: 'Message',
			field: 'message',
			width: 300,
			id: 'message',
			formatter: (row, cell, value, columnDef, dataContext) => this.renderMessage(row, cell, value, columnDef, dataContext),
		},
		{ name: 'Tags', field: 'tags', width: 80, id: 'tags' },
		{ name: 'Check ID', field: 'checkId', maxWidth: 140, id: 'checkId' },
		{
			name: 'Target',
			formatter: (row, cell, value, columnDef, dataContext) => this.renderTarget(row, cell, value, columnDef, dataContext),
			field: 'targetName',
			width: 80,
			id: 'target'
		}
	];
	private rowDetail: RowDetailView<IItem>;
	private exportActionItem: IAction;
	private gridPlaceholder: JQuery<HTMLElement>;
	private serverName: string;
	private databaseName: string;

	@ViewChild('resultsgrid') _gridEl: ElementRef;
	@ViewChild('actionbarContainer') protected actionBarContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => AsmtViewComponent)) private _asmtViewComponent: AsmtViewComponent,
		@Inject(IAssessmentService) private _assessmentService: IAssessmentService,
		@Inject(IWorkbenchThemeService) private _themeService: IWorkbenchThemeService,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IContextMenuService) _contextMenuService: IContextMenuService,
		@Inject(IKeybindingService) _keybindingService: IKeybindingService,
		@Inject(IDashboardService) _dashboardService: IDashboardService,
		@Inject(IObjectExplorerService) _objectExporerService: IObjectExplorerService

		//,@Inject(ITelemetryService) private _telemetryService: ITelemetryService
	) {
		super();
		let self = this;
		let profile = this._commonService.connectionManagementService.connectionInfo.connectionProfile;

		this.isServerMode = !profile.databaseName || Utils.isMaster(profile);
		this.serverName = profile.serverName;
		this.databaseName = profile.databaseName;

		_dashboardService.onLayout((d) => {
			self.layout();
		});
	}

	ngOnInit(): void {
		this._visibilityElement = this._gridEl;
		this._parentComponent = this._asmtViewComponent;
		//this._telemetryService.publicLog(TelemetryKeys.AsmtView);

	}
	ngAfterContentChecked(): void {
		if (this._visibilityElement && this._parentComponent) {
			if (this.isVisible === false && this._visibilityElement.nativeElement.offsetParent !== null) {
				this.isVisible = true;
				if (!this.isInitialized) {
					//this._showProgressWheel = true;
					this.onFirstVisible();
					this.layout();
					this.isInitialized = true;
				}
			} else if (this.isVisible === true && this._parentComponent.refresh === true) {
				//this._showProgressWheel = true;
				this.isRefreshing = true;
				this.onFirstVisible();
				this.layout();
				this._parentComponent.refresh = false;
			} else if (this.isVisible === true && this._visibilityElement.nativeElement.offsetParent === null) {
				this.isVisible = false;
			}
		}
	}

	public layout(): void {
		let asmtViewToolbar = jQuery('asmt-results-view-component .asmt-actionbar-container').get(0);
		let statusBar = jQuery('.part.statusbar').get(0);

		if (asmtViewToolbar && statusBar) {
			let toolbarBottom = asmtViewToolbar.getBoundingClientRect().bottom + ACTIONBAR_PADDING;
			let statusTop = statusBar.getBoundingClientRect().top;
			this._table.layout(new dom.Dimension(
				dom.getContentWidth(this._gridEl.nativeElement),
				statusTop - toolbarBottom));

			let gridCanvasWidth = this._table.grid.getCanvasNode().clientWidth;
			this.gridPlaceholder.css('left', ((gridCanvasWidth - this.gridPlaceholder.width()) / 2).toString() + 'px');

		}
	}

	ngOnDestroy(): void {
	}

	protected initActionBar() {
		let serverSelectItems = this._instantiationService.createInstance(AsmtServerSelectItemsAction);
		let serverInvokeAsmt = this._instantiationService.createInstance(AsmtServerInvokeItemsAction);
		let databaseSelectAsmt = this._instantiationService.createInstance(AsmtDatabaseSelectItemsAction);
		let databaseInvokeAsmt = this._instantiationService.createInstance(AsmtDatabaseInvokeItemsAction);
		this.exportActionItem = this._instantiationService.createInstance(AsmtExportAsScriptAction);

		let taskbar = <HTMLElement>this.actionBarContainer.nativeElement;
		let connectionInfo = this._commonService.connectionManagementService.connectionInfo;

		this._actionBar = new Taskbar(taskbar);
		if (this.isServerMode) {
			this._actionBar.setContent([
				{ action: serverSelectItems },
				{ action: serverInvokeAsmt },
				{ action: this.exportActionItem }
			]);
		} else {
			this._actionBar.setContent([
				{ action: databaseSelectAsmt },
				{ action: databaseInvokeAsmt },
				{ action: this.exportActionItem }
			]);
			databaseSelectAsmt.label = connectionInfo.connectionProfile.databaseName + ' ' + AsmtDatabaseSelectItemsAction.LABEL;
			databaseInvokeAsmt.label = AsmtDatabaseInvokeItemsAction.LABEL + ' for ' + connectionInfo.connectionProfile.databaseName;
		}

		let context: IAsmtActionInfo = { component: this, ownerUri: connectionInfo.ownerUri };
		this._actionBar.context = context;
		this.exportActionItem.enabled = false;

	}

	private onFirstVisible() {

		let columns = this.columns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});
		let options = <Slick.GridOptions<any>>{
			syncColumnCellResize: true,
			enableColumnReorder: false,
			rowHeight: ROW_HEIGHT,
			enableCellNavigation: true,
			forceFitColumns: false
		};

		this.dataView = new Slick.Data.DataView({ inlineFilters: false });

		let rowDetail = new RowDetailView<IItem>({
			cssClass: '_detail_selector',
			process: (item) => {
				(<any>rowDetail).onAsyncResponse.notify({
					'itemDetail': item,
				}, undefined, this);
			},
			useRowClick: true,
			panelRows: 2,
			postTemplate: (itemDetail) => this.renderMessage(undefined, undefined, undefined, undefined, itemDetail),
			preTemplate: () => '',
			loadOnce: true
		});
		this.rowDetail = rowDetail;
		let columnDef = this.rowDetail.getColumnDefinition();
		columnDef.formatter = (row, cell, value, columnDef, dataContext) => this.detailSelectionFormatter(row, cell, value, columnDef, dataContext as ExtendedItem<IItem>);
		columns.unshift(columnDef);

		let filterPlugin = new HeaderFilter<{ inlineFilters: false }>();

		this._register(attachButtonStyler(filterPlugin, this._themeService));
		this.filterPlugin = filterPlugin;
		filterPlugin['getFilterValues'] = this.getFilterValues;
		filterPlugin['getAllFilterValues'] = this.getAllFilterValues;
		filterPlugin['getFilterValuesByInput'] = this.getFilterValuesByInput;

		jQuery(this._gridEl.nativeElement).empty();
		jQuery(this.actionBarContainer.nativeElement).empty();
		this.initActionBar();
		this._table = new Table(this._gridEl.nativeElement, { columns }, options);
		this._table.grid.setData(this.dataView, true);
		this.gridPlaceholder = jQuery(this._table.grid.getCanvasNode()).html('<span class=\'placeholder\'></span>').find('.placeholder');
		this.gridPlaceholder.text(PLACEHOLDER_LABEL);
	}

	private getFilterValues(dataView: Slick.DataProvider<Slick.SlickData>, column: Slick.Column<any>): Array<any> {
		const seen: Array<string> = [];
		for (let i = 0; i < dataView.getLength(); i++) {
			const value = dataView.getItem(i)[column.field!];
			if (value instanceof Array) {
				for (let item = 0; item < value.length; item++) {
					if (!seen.some(x => x === value[item])) {
						seen.push(value[item]);
					}
				}
			} else {
				if (!seen.some(x => x === value)) {
					seen.push(value);
				}
			}
		}
		return seen;
	}

	private getAllFilterValues(data: Array<Slick.SlickData>, column: Slick.Column<any>) {
		const seen: Array<any> = [];
		for (let i = 0; i < data.length; i++) {
			const value = data[i][column.field!];
			if (value instanceof Array) {
				for (let item = 0; item < value.length; item++) {
					if (!seen.some(x => x === value[item])) {
						seen.push(value[item]);
					}
				}
			} else {
				if (!seen.some(x => x === value)) {
					seen.push(value);
				}
			}
		}

		return seen.sort((v) => { return v; });
	}

	private getFilterValuesByInput($input: JQuery<HTMLElement>): Array<string> {
		const column = $input.data('column'),
			filter = $input.val() as string,
			dataView = this['grid'].getData() as Slick.DataProvider<Slick.SlickData>,
			seen: Array<any> = [];

		for (let i = 0; i < dataView.getLength(); i++) {
			const value = dataView.getItem(i)[column.field];
			if (value instanceof Array) {
				if (filter.length > 0) {
					const itemValue = !value ? [] : value;
					const lowercaseFilter = filter.toString().toLowerCase();
					const lowercaseVals = itemValue.map(v => v.toLowerCase());
					for (let valIdx = 0; valIdx < value.length; valIdx++) {
						if (!seen.some(x => x === value[valIdx]) && lowercaseVals[valIdx].indexOf(lowercaseFilter) > -1) {
							seen.push(value[valIdx]);
						}
					}
				}
				else {
					for (let item = 0; item < value.length; item++) {
						if (!seen.some(x => x === value[item])) {
							seen.push(value[item]);
						}
					}
				}

			} else {
				if (filter.length > 0) {
					const itemValue = !value ? '' : value;
					const lowercaseFilter = filter.toString().toLowerCase();
					const lowercaseVal = itemValue.toString().toLowerCase();

					if (!seen.some(x => x === value) && lowercaseVal.indexOf(lowercaseFilter) > -1) {
						seen.push(value);
					}
				}
				else {
					if (!seen.some(x => x === value)) {
						seen.push(value);
					}
				}
			}
		}

		return seen.sort((v) => { return v; });
	}

	private clearOutDefaultRuleset(tags: string[]): string[] {
		let idx = tags.indexOf('DefaultRuleset');
		if (idx > -1) {
			tags.splice(idx, 1);
		}
		return tags;
	}

	private onResultsAvailable(results: azdata.AssessmentResultItem[], isServer: boolean) {
		let resultViews: any;
		let self = this;
		resultViews = results.map((asmtResult, ind, array) => {
			return {
				id: ind,
				severity: asmtResult.level,
				message: asmtResult.message,
				tags: self.clearOutDefaultRuleset(asmtResult.tags),
				checkId: asmtResult.checkId,
				targetName: asmtResult.targetName,
				targetType: asmtResult.targetType,
				helpLink: asmtResult.helpLink
			};
		});

		this.filterPlugin.onFilterApplied.subscribe((e, args) => {
			let filterValues = args.column.filterValues;
			if (filterValues) {
				this.dataView.refresh();
				this._table.grid.resetActiveCell();
			}
		});

		this.filterPlugin.onCommand.subscribe((e, args: any) => {
			this.columnSort(args.column.name, args.command === 'sort-asc');
		});
		this._table.registerPlugin(this.filterPlugin);
		this._table.registerPlugin(<any>this.rowDetail);



		this.dataView.beginUpdate();
		this.dataView.setItems(resultViews);
		this.dataView.setFilter((item) => this.filter(item));
		this.dataView.endUpdate();
		this.dataView.refresh();

		this._table.autosizeColumns();
		this._table.resizeCanvas();

		// tooltip for tags
		jQuery('.slick-cell').hover(e => {
			let currentTarget = e.currentTarget;
			currentTarget.title = currentTarget.innerText;
		});

		this.exportActionItem.enabled = true;
		if (results.length > 0) {
			this.gridPlaceholder.hide();
		} else {
			let objectType = isServer ? 'Server' : 'Database';
			let objectName = isServer ? this.serverName : this.databaseName;
			this.gridPlaceholder.text(PLACEHOLDER_NO_RESULTS_LABEL.replace('<OBJECT_TYPE>', objectType).replace('<OBJECT_NAME>', objectName));
		}
	}

	private columnSort(column: string, isAscending: boolean) {
		let items = this.dataView.getItems();
		// get error items here and remove them
		let jobItems = items.filter(x => x._parent === undefined);
		this.dataView.setItems(jobItems);
		this.dataView.sort((item1, item2) => {
			return item1.checkId.localeCompare(item2.checkId);
		}, isAscending);

	}

	private filter(item: any) {
		let columns = this._table.grid.getColumns();
		let value = true;
		for (let i = 0; i < columns.length; i++) {
			let col: any = columns[i];
			let filterValues = col.filterValues;
			if (filterValues && filterValues.length > 0) {
				if (item._parent) {
					value = value && find(filterValues, x => x === item._parent[col.field]);
				} else {
					let colValue = item[col.field];
					if (colValue instanceof Array) {
						value = value && find(filterValues, x => colValue.indexOf(x) >= 0);
					} else {
						value = value && find(filterValues, x => x === colValue);
					}

				}
			}
		}
		return value;
	}

	private renderMessage(_row, _cell, _value, _columnDef, dataContext) {
		return dataContext.message + '<a class=\'helpLink\' href=\'' + dataContext.helpLink + '\'>Learn More</a>';
	}

	private renderTarget(_row, _cell, _value, _columnDef, dataContext) {
		let targetClass = 'defaultDatabaseIcon';
		if (dataContext.targetType === 1) {
			targetClass = 'defaultServerIcon';
		}
		return '<div class=\'carbon-taskbar\'><span class=\'action-label codicon ' + targetClass + '\'>' + dataContext.targetName + '</span></div>';
	}

	public detailSelectionFormatter(_row: number, _cell: number, _value: any, _columnDef: Slick.Column<IItem>, dataContext: IItem): string | undefined {

		if (dataContext._collapsed === undefined) {
			dataContext._collapsed = true;
			dataContext._sizePadding = 0;	//the required number of pading rows
			dataContext._height = 0;	//the actual height in pixels of the detail field
			dataContext._isPadding = false;
			dataContext._parent = undefined;
		}

		if (dataContext._isPadding === true) {
			//render nothing
		} else if (dataContext._collapsed) {
			return '<div class=\'detailView-toggle expand\'></div>';
		} else {
			const html: Array<string> = [];
			const rowHeight = ROW_HEIGHT;
			const bottomMargin = 5;
			html.push('<div class="detailView-toggle collapse"></div></div>');

			html.push(`<div id='cellDetailView_${dataContext.id}' class='dynamic-cell-detail' `);   //apply custom css to detail
			html.push(`style=\'height:${dataContext._height}px;`); //set total height of padding
			html.push(`top:${rowHeight}px'>`);             //shift detail below 1st row
			html.push(`<div id='detailViewContainer_${dataContext.id}"'  class='detail-container' style='max-height:${(dataContext._height! - rowHeight + bottomMargin)}px'>`); //sub ctr for custom styling
			html.push(`<div id='innerDetailView_${dataContext.id}'>${dataContext._detailContent!}</div></div>`);
			return html.join('');
		}
		return undefined;
	}

	public getAssessmentServerItems() {
		this._showProgressWheel = true;
		if (this.isVisible) {
			this._cd.detectChanges();
		}
	}
	public getAssessmentDatabaseItems() {

	}

	public async invokeAssessmentServerItems(ownerUri: string) {

		this._showProgressWheel = true;
		if (this.isVisible) {
			this._cd.detectChanges();
		}

		this.displayAssessmentResults(await this._assessmentService.assessmentInvoke(ownerUri), true);
	}

	public invokeAssessmentDatabaseItems() {

	}

	public async exportAsScript() {
		let connection = this._commonService.connectionManagementService.connectionInfo.connectionProfile;
		let queryString = `CREATE TABLE [dbo].[AssessmentResult](
			[CheckName] [nvarchar](max) NOT NULL,
			[CheckId] [nvarchar](max) NOT NULL,
			[RulesetName] [nvarchar](max) NOT NULL,
			[RulesetVersion] [nvarchar](max) NOT NULL,
			[Severity] [nvarchar](max) NOT NULL,
			[Message] [nvarchar](max) NOT NULL,
			[TargetPath] [nvarchar](max) NOT NULL,
			[TargetType] [nvarchar](max) NOT NULL,
			[HelpLink] [nvarchar](max) NOT NULL,
			[Timestamp] [datetimeoffset](7) NOT NULL
		) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
		GO`;

		this._instantiationService.invokeFunction(openNewQuery, connection, queryString);
	}

	private displayAssessmentResults(assessmentResult: azdata.AssessmentResult, isServer: boolean) {
		this._showProgressWheel = false;
		if (assessmentResult) {
			this.onResultsAvailable(assessmentResult.results, isServer);
			this._asmtViewComponent.displayAssessmentInfo(assessmentResult.apiVersion, assessmentResult.rulesetVersion);
		}

		if (this.isVisible) {
			this._cd.detectChanges();
		}

		this._table.grid.invalidate();
	}

}
