/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';

export const SERVICE_ID = 'assessmentService';

export const IAssessmentService = createDecorator<IAssessmentService>(SERVICE_ID);

export interface IAssessmentService {
	_serviceBrand: undefined;
	onDidChange: Event<void>;

	registerProvider(providerId: string, provider: azdata.AssessmentServicesProvider): void;
	fireOnDidChange(): void;
	// getAssessmentDatabaseResults(connection: ConnectionProfile): Thenable<azdata.AssessmentResult>;
	// getAssessmentServerResults(connection: ConnectionProfile): Thenable<azdata.AssessmentResult>;
	// getAssessmentTotalResults(connection: ConnectionProfile): Thenable<azdata.AssessmentResult>;
	assessmentInvoke(connectionUri: string): Thenable<azdata.AssessmentResult>;
}
