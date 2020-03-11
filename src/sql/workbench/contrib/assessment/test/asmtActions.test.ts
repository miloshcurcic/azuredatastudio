/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { AsmtServerInvokeItemsAction } from 'sql/workbench/contrib/assessment/browser/asmtActions';
import { AssessmentService } from 'sql/workbench/services/assessment/common/assessmentService';

/**
 * Class to test Assessment Management Actions
 */
class TestAssessmentView {
	invokeServerAssessment() { return undefined; }
}

// Mock View Components
let mockAsmtViewComponent: TypeMoq.Mock<TestAssessmentView>;
let mockAssessmentService: TypeMoq.Mock<AssessmentService>;

// Mock Job Actions
let mockAsmtServerInvokeItemsAction: TypeMoq.Mock<AsmtServerInvokeItemsAction>;


// Tests
suite('Assessment Actions', () => {

	// Actions
	setup(() => {
		mockAsmtViewComponent = TypeMoq.Mock.ofType<TestAssessmentView>(TestAssessmentView);
		mockAssessmentService = TypeMoq.Mock.ofType<AssessmentService>(AssessmentService);
		mockAssessmentService.setup(s => s.assessmentInvoke(TypeMoq.It.isAny()))
			.returns(() => {
				let items: azdata.AssessmentResultItem[] = [
					<azdata.AssessmentResultItem>{ checkId: 'AutoCreateStats', targetType: 1, targetName: 'dbName', level: 'WARN', tags: ['DefaultRuleset', 'Performance', 'Statistics', 'QueryOptimizer'], displayName: 'Auto-Create Statistics should be on', description: 'The Query Optimizer determines whether an index is useful for a specific query by evaluating the stored statistics. If the statistics become out of date and significant changes have occurred against the underlying data, this can result in less than optimal query performance. In most cases, it\'s best to let SQL Server maintain the statistics. If you turn \'Auto Create Stats\' and \'Auto Update Stats\' off, then it is up to you to keep the statistics up-to-date somehow. Failure to do so will lead to poor query performance. Most applications should have these options ON. When the Auto Create statistics setting is ON, the Query Optimizer creates statistics on one or more columns of a table or an indexed view, as necessary, to improve query plans and query performance.', message: 'Turn Auto-Create Statistics option on to improve query performance.', helpLink: 'https://docs.microsoft.com/sql/relational-databases/statistics/statistics#CreateStatistics' },
					<azdata.AssessmentResultItem>{ checkId: 'QueryStoreOn', targetType: 1, targetName: 'dbName', level: 'WARN', tags: ['DefaultRuleset', 'Performance', 'Statistics', 'QueryStore'], displayName: 'Query Store should be active', description: 'The Query Store feature provides you with insight on query plan choice and performance. It simplifies performance troubleshooting by helping you quickly find performance differences caused by query plan changes. Query Store automatically captures a history of queries, plans, and runtime statistics, and retains these for your review. It separates data by time windows so you can see database usage patterns and understand when query plan changes happened on the server. While Query Store collects queries, execution plans and statistics, its size in the database grows until this limit is reached. When that happens, Query Store automatically changes the operation mode to read-only and stops collecting new data, which means that your performance analysis is no longer accurate.', message: 'Make sure Query Store actual operation mode is \'Read Write\' to keep your performance analysis accurate', helpLink: 'https://docs.microsoft.com/sql/relational-databases/performance/monitoring-performance-by-using-the-query-store' },
					<azdata.AssessmentResultItem>{ checkId: 'FKNoIndexes', targetType: 1, targetName: 'dbName', level: 'WARN', tags: ['DefaultRuleset', 'Performance', 'Indexes'], displayName: 'Foreign key constraints should have corresponding indexes', description: 'Unlike primary key constraints, creating a foreign key constraint does not automatically create a corresponding index. However, manually creating an index on a foreign key is often useful.', message: 'Create a corresponding index for each foreign key. There is no index on the following foreign keys: [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1].', helpLink: 'https://docs.microsoft.com/sql/relational-databases/tables/primary-and-foreign-key-constraints' }
				];

				let result: azdata.AssessmentResult = {
					success: true,
					errorMessage: '',
					results: items,
					rulesetVersion: '1.0.6',
					apiVersion: '1.0.0'
				};

				return Promise.resolve(result);

			});
	});

	test('Invoke Assessment Action', async () => {
		mockAsmtServerInvokeItemsAction = TypeMoq.Mock.ofType(AsmtServerInvokeItemsAction, TypeMoq.MockBehavior.Strict, AsmtServerInvokeItemsAction.ID, AsmtServerInvokeItemsAction.LABEL);
		mockAsmtServerInvokeItemsAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockAsmtViewComponent.object.invokeServerAssessment());
		mockAsmtServerInvokeItemsAction.setup(s => s.id).returns(() => AsmtServerInvokeItemsAction.ID);
		mockAsmtServerInvokeItemsAction.setup(s => s.label).returns(() => AsmtServerInvokeItemsAction.LABEL);
		assert.equal(mockAsmtServerInvokeItemsAction.object.id, AsmtServerInvokeItemsAction.ID);
		assert.equal(mockAsmtServerInvokeItemsAction.object.label, AsmtServerInvokeItemsAction.LABEL);

		// Job Refresh Action from Jobs View should refresh the component
		await mockAsmtServerInvokeItemsAction.object.run(null);
		mockAsmtViewComponent.verify(c => c.invokeServerAssessment(), TypeMoq.Times.once());
	});

});
