/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IAssessmentService } from 'sql/workbench/services/assessment/common/interfaces';
import { Event, Emitter } from 'vs/base/common/event';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';

export class AssessmentService implements IAssessmentService {
	_serviceBrand: undefined;

	private _onDidChange = new Emitter<void>();
	public readonly onDidChange: Event<void> = this._onDidChange.event;

	private _providers: { [handle: string]: azdata.AssessmentServicesProvider; } = Object.create(null);
	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService
	) {

	}

	public fireOnDidChange(): void {
		this._onDidChange.fire(void 0);
	}

	public assessmentInvoke(connectionUri: string): Thenable<azdata.AssessmentResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.assessmentInvoke(connectionUri);
		});
	}

	private _runAction<T>(uri: string, action: (handler: azdata.AssessmentServicesProvider) => Thenable<T>): Thenable<T> {
		let providerId: string = this._connectionService.getProviderIdFromUri(uri);

		if (!providerId) {
			return Promise.reject(new Error('Connection is required in order to interact with AssessmentService'));
		}
		let handler = this._providers[providerId];
		if (handler) {
			return action(handler);
		} else {
			return Promise.reject(new Error('No Handler Registered'));
		}
	}

	public getAssessmentDatabaseResults(connection: ConnectionProfile): Thenable<azdata.AssessmentResult> {
		let items: azdata.AssessmentResultItem[] = [
			<azdata.AssessmentResultItem>{ checkId: 'AutoCreateStats', targetType: 1, targetName: connection.databaseName, level: 'WARN', tags: ['DefaultRuleset', 'Performance', 'Statistics', 'QueryOptimizer'], displayName: 'Auto-Create Statistics should be on', description: 'The Query Optimizer determines whether an index is useful for a specific query by evaluating the stored statistics. If the statistics become out of date and significant changes have occurred against the underlying data, this can result in less than optimal query performance. In most cases, it\'s best to let SQL Server maintain the statistics. If you turn \'Auto Create Stats\' and \'Auto Update Stats\' off, then it is up to you to keep the statistics up-to-date somehow. Failure to do so will lead to poor query performance. Most applications should have these options ON. When the Auto Create statistics setting is ON, the Query Optimizer creates statistics on one or more columns of a table or an indexed view, as necessary, to improve query plans and query performance.', message: 'Turn Auto-Create Statistics option on to improve query performance.', helpLink: 'https://docs.microsoft.com/sql/relational-databases/statistics/statistics#CreateStatistics' },
			<azdata.AssessmentResultItem>{ checkId: 'QueryStoreOn', targetType: 1, targetName: connection.databaseName, level: 'WARN', tags: ['DefaultRuleset', 'Performance', 'Statistics', 'QueryStore'], displayName: 'Query Store should be active', description: 'The Query Store feature provides you with insight on query plan choice and performance. It simplifies performance troubleshooting by helping you quickly find performance differences caused by query plan changes. Query Store automatically captures a history of queries, plans, and runtime statistics, and retains these for your review. It separates data by time windows so you can see database usage patterns and understand when query plan changes happened on the server. While Query Store collects queries, execution plans and statistics, its size in the database grows until this limit is reached. When that happens, Query Store automatically changes the operation mode to read-only and stops collecting new data, which means that your performance analysis is no longer accurate.', message: 'Make sure Query Store actual operation mode is \'Read Write\' to keep your performance analysis accurate', helpLink: 'https://docs.microsoft.com/sql/relational-databases/performance/monitoring-performance-by-using-the-query-store' },
			<azdata.AssessmentResultItem>{ checkId: 'FKNoIndexes', targetType: 1, targetName: connection.databaseName, level: 'WARN', tags: ['DefaultRuleset', 'Performance', 'Indexes'], displayName: 'Foreign key constraints should have corresponding indexes', description: 'Unlike primary key constraints, creating a foreign key constraint does not automatically create a corresponding index. However, manually creating an index on a foreign key is often useful.', message: 'Create a corresponding index for each foreign key. There is no index on the following foreign keys: [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1], [dbo].[Table2].[FK_Table2_Table1], [sh1].[Table2].[FK_Table2_Table1].', helpLink: 'https://docs.microsoft.com/sql/relational-databases/tables/primary-and-foreign-key-constraints' }
		];


		let result: azdata.AssessmentResult = {
			success: true,
			errorMessage: '',
			results: items,
			rulesetVersion: '1.0.6',
			apiVersion: '1.0.0'
		};

		return Promise.resolve(result);
	}
	getAssessmentServerResults(connection: ConnectionProfile): Thenable<azdata.AssessmentResult> {
		let items: azdata.AssessmentResultItem[] = [
			<azdata.AssessmentResultItem>{ checkId: 'TF174', targetType: 0, targetName: connection.serverName, level: 'INFO', tags: ['DefaultRuleset', 'TraceFlag', 'Memory', 'Performance'], displayName: 'TF 174 increases the plan cache bucket count', description: 'Trace Flag 174 increases the SQL Server plan cache bucket count from 40,009 to 160,001 on 64-bit systems.\n When the SQL Server plan cache reaches its entry limit, plans that have low cost must be evicted in order to insert new plans. This can cause severe contention on the SOS_CACHESTORE spinlock and a high CPU usage occurs in SQL Server.\n On 64-bit systems, the number of buckets for the SQL Server plan cache is 40,009. Therefore, the maximum number of entries that can fit inside the SQL Server plan cache is 160,036. Enabling trace flag 174 on high performance systems increases the size of the cache and can avoid SOS_CACHESTORE spinlock contention.', message: 'Consider enabling trace flag 174 to increase the plan cache bucket count.', helpLink: 'https://docs.microsoft.com/sql/t-sql/database-console-commands/dbcc-traceon-trace-flags-transact-sql' },
			<azdata.AssessmentResultItem>{ checkId: 'TF2330', targetType: 0, targetName: connection.serverName, level: 'WARN', tags: ['DefaultRuleset', 'TraceFlag', 'Performance', 'Indexes'], displayName: 'TF 2330 disables recording of index usage stats', description: 'Trace Flag 2330 disables recording of index usage stats, which could lead to a non-yielding condition in SQL 2005.', message: 'Trace Flag 2330 does not apply to this SQL Server version. Verify need to set a non-default trace flag with the current system build and configuration.', helpLink: 'https://blogs.msdn.microsoft.com/ialonso/2012/10/08/faq-around-sys-dm_db_index_usage_stats' },
			<azdata.AssessmentResultItem>{ checkId: 'TF2371', targetType: 0, targetName: connection.serverName, level: 'INFO', tags: ['DefaultRuleset', 'TraceFlag', 'Statistics', 'Performance'], displayName: 'TF 2371 enables a linear recompilation threshold for statistics', description: 'Trace Flag 2371 causes SQL Server to change the fixed update statistics threshold to a linear update statistics threshold.\n This is especially useful to keep statistics updated on large tables.', message: 'Enable trace Flag 2371 to allow a linear recompilation threshold for statistics.', helpLink: 'https://docs.microsoft.com/sql/t-sql/database-console-commands/dbcc-traceon-trace-flags-transact-sql' },
			<azdata.AssessmentResultItem>{ checkId: 'DefaultTrace', targetType: 0, targetName: connection.serverName, level: 'WARN', tags: ['DefaultRuleset', 'Traces'], displayName: 'No default trace was found or is not active', description: 'Default trace provides troubleshooting assistance to database administrators by ensuring that they have the log data necessary to diagnose problems the first time they occur.', message: 'Make sure that there is enough space for SQL Server to write the default trace file. Then have the default trace run by disabling and re-enabling it.', helpLink: 'https://docs.microsoft.com/sql/relational-databases/policy-based-management/default-trace-log-files-disabled' }
		];


		let result: azdata.AssessmentResult = {
			success: true,
			errorMessage: '',
			results: items,
			rulesetVersion: '1.0.6',
			apiVersion: '1.0.0'
		};

		return Promise.resolve(result);
	}

	getAssessmentTotalResults(connection: ConnectionProfile): Thenable<azdata.AssessmentResult> {
		let items: azdata.AssessmentResultItem[] = [
			<azdata.AssessmentResultItem>{ checkId: 'AutoCreateStats', targetType: 1, targetName: connection.databaseName, level: 'WARN', tags: ['DefaultRuleset', 'Performance', 'Statistics', 'QueryOptimizer'], displayName: 'Auto-Create Statistics should be on', description: 'The Query Optimizer determines whether an index is useful for a specific query by evaluating the stored statistics. If the statistics become out of date and significant changes have occurred against the underlying data, this can result in less than optimal query performance. In most cases, it\'s best to let SQL Server maintain the statistics. If you turn \'Auto Create Stats\' and \'Auto Update Stats\' off, then it is up to you to keep the statistics up-to-date somehow. Failure to do so will lead to poor query performance. Most applications should have these options ON. When the Auto Create statistics setting is ON, the Query Optimizer creates statistics on one or more columns of a table or an indexed view, as necessary, to improve query plans and query performance.', message: 'Turn Auto-Create Statistics option on to improve query performance.', helpLink: 'https://docs.microsoft.com/sql/relational-databases/statistics/statistics#CreateStatistics' },
			<azdata.AssessmentResultItem>{ checkId: 'QueryStoreOn', targetType: 1, targetName: connection.databaseName, level: 'WARN', tags: ['DefaultRuleset', 'Performance', 'Statistics', 'QueryStore'], displayName: 'Query Store should be active', description: 'The Query Store feature provides you with insight on query plan choice and performance. It simplifies performance troubleshooting by helping you quickly find performance differences caused by query plan changes. Query Store automatically captures a history of queries, plans, and runtime statistics, and retains these for your review. It separates data by time windows so you can see database usage patterns and understand when query plan changes happened on the server. While Query Store collects queries, execution plans and statistics, its size in the database grows until this limit is reached. When that happens, Query Store automatically changes the operation mode to read-only and stops collecting new data, which means that your performance analysis is no longer accurate.', message: 'Make sure Query Store actual operation mode is \'Read Write\' to keep your performance analysis accurate', helpLink: 'https://docs.microsoft.com/sql/relational-databases/performance/monitoring-performance-by-using-the-query-store' },
			<azdata.AssessmentResultItem>{ checkId: 'TF174', targetType: 0, targetName: connection.serverName, level: 'INFO', tags: ['DefaultRuleset', 'TraceFlag', 'Memory', 'Performance'], displayName: 'TF 174 increases the plan cache bucket count', description: 'Trace Flag 174 increases the SQL Server plan cache bucket count from 40,009 to 160,001 on 64-bit systems.\n When the SQL Server plan cache reaches its entry limit, plans that have low cost must be evicted in order to insert new plans. This can cause severe contention on the SOS_CACHESTORE spinlock and a high CPU usage occurs in SQL Server.\n On 64-bit systems, the number of buckets for the SQL Server plan cache is 40,009. Therefore, the maximum number of entries that can fit inside the SQL Server plan cache is 160,036. Enabling trace flag 174 on high performance systems increases the size of the cache and can avoid SOS_CACHESTORE spinlock contention.', message: 'Consider enabling trace flag 174 to increase the plan cache bucket count.', helpLink: 'https://docs.microsoft.com/sql/t-sql/database-console-commands/dbcc-traceon-trace-flags-transact-sql' },
			<azdata.AssessmentResultItem>{ checkId: 'TF2330', targetType: 0, targetName: connection.serverName, level: 'WARN', tags: ['DefaultRuleset', 'TraceFlag', 'Performance', 'Indexes'], displayName: 'TF 2330 disables recording of index usage stats', description: 'Trace Flag 2330 disables recording of index usage stats, which could lead to a non-yielding condition in SQL 2005.', message: 'Trace Flag 2330 does not apply to this SQL Server version. Verify need to set a non-default trace flag with the current system build and configuration.', helpLink: 'https://blogs.msdn.microsoft.com/ialonso/2012/10/08/faq-around-sys-dm_db_index_usage_stats' },
			<azdata.AssessmentResultItem>{ checkId: 'TF2371', targetType: 0, targetName: 'serverName', level: 'INFO', tags: ['DefaultRuleset', 'TraceFlag', 'Statistics', 'Performance'], displayName: 'TF 2371 enables a linear recompilation threshold for statistics', description: 'Trace Flag 2371 causes SQL Server to change the fixed update statistics threshold to a linear update statistics threshold.\n This is especially useful to keep statistics updated on large tables.', message: 'Enable trace Flag 2371 to allow a linear recompilation threshold for statistics.', helpLink: 'https://docs.microsoft.com/sql/t-sql/database-console-commands/dbcc-traceon-trace-flags-transact-sql' },
			<azdata.AssessmentResultItem>{ checkId: 'DefaultTrace', targetType: 0, targetName: connection.serverName, level: 'WARN', tags: ['DefaultRuleset', 'Traces'], displayName: 'No default trace was found or is not active', description: 'Default trace provides troubleshooting assistance to database administrators by ensuring that they have the log data necessary to diagnose problems the first time they occur.', message: 'Make sure that there is enough space for SQL Server to write the default trace file. Then have the default trace run by disabling and re-enabling it.', helpLink: 'https://docs.microsoft.com/sql/relational-databases/policy-based-management/default-trace-log-files-disabled' }
		];


		let result: azdata.AssessmentResult = {
			success: true,
			errorMessage: '',
			results: items,
			rulesetVersion: '1.0.6',
			apiVersion: '1.0.0'

		};

		return Promise.resolve(result);
	}


	public registerProvider(providerId: string, provider: azdata.AssessmentServicesProvider): void {
		this._providers[providerId] = provider;
	}

}
