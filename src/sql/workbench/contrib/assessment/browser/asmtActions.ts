/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { AsmtResultsViewComponent } from 'sql/workbench/contrib/assessment/browser/asmtResultsView.component';

export class IAsmtActionInfo {
	ownerUri?: string;
	component: AsmtResultsViewComponent;
}


export class AsmtServerSelectItemsAction extends Action {
	public static ID = 'asmtaction.server.getitems';
	public static LABEL = 'View applicable rules';

	constructor(
	) {
		super(AsmtServerSelectItemsAction.ID, AsmtServerSelectItemsAction.LABEL, 'defaultServerIcon');
	}

	public run(context: IAsmtActionInfo): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			if (context) {
				if (context.component) {
					context.component.getAssessmentServerItems();
				}
				resolve(true);
			} else {
				reject(false);
			}
		});
	}
}

export class AsmtDatabaseSelectItemsAction extends Action {
	public static ID = 'asmtaction.database.getitems';
	public static LABEL = 'applicable rules';

	constructor(
	) {
		super(AsmtServerSelectItemsAction.ID, AsmtServerSelectItemsAction.LABEL, 'defaultDatabaseIcon');
	}

	public run(context: IAsmtActionInfo): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			if (context) {
				if (context.component) {
					context.component.getAssessmentDatabaseItems();
				}
				resolve(true);
			} else {
				reject(false);
			}
		});
	}
}


export class AsmtServerInvokeItemsAction extends Action {
	public static ID = 'asmtaction.server.invokeitems';
	public static LABEL = nls.localize(AsmtServerInvokeItemsAction.ID, "Invoke Assessment");

	constructor(
	) {
		super(AsmtServerInvokeItemsAction.ID, AsmtServerInvokeItemsAction.LABEL, 'defaultServerIcon');
	}

	public run(context: IAsmtActionInfo): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			if (context) {
				if (context.component) {
					context.component.invokeAssessmentServerItems(context.ownerUri);
				}
				resolve(true);
			} else {
				reject(false);
			}
		});
	}
}

export class AsmtDatabaseInvokeItemsAction extends Action {
	public static ID = 'asmtaction.database.invokeitems';
	public static LABEL = 'Invoke Assessment';

	constructor(
	) {
		super(AsmtServerInvokeItemsAction.ID, AsmtServerInvokeItemsAction.LABEL, 'defaultDatabaseIcon');
	}

	public run(context: IAsmtActionInfo): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			if (context) {
				if (context.component) {
					context.component.invokeAssessmentDatabaseItems();
				}
				resolve(true);
			} else {
				reject(false);
			}
		});
	}
}

export class AsmtExportAsScriptAction extends Action {
	public static ID = 'asmtaction.exportasscript';
	public static LABEL = 'Export As Script';

	constructor(
	) {
		super(AsmtExportAsScriptAction.ID, AsmtExportAsScriptAction.LABEL, 'exportAsScriptIcon');
	}

	public run(context: IAsmtActionInfo): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			if (context) {
				if (context.component) {
					context.component.exportAsScript();
				}
				resolve(true);
			} else {
				reject(false);
			}
		});
	}
}
