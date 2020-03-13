/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../common/constants';
import * as dataSources from '../models/dataSources/dataSources';

import { Guid } from 'guid-typescript';
import { newSqlProjectTemplate } from '../../resources/newSqlprojTemplate';
import { Project } from '../models/project';
import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { promises as fs } from 'fs';

/**
 * Controller for managing project lifecycle
 */
export class ProjectsController {
	private projectTreeViewProvider: SqlDatabaseProjectTreeViewProvider;

	projects: Project[] = [];

	constructor(projTreeViewProvider: SqlDatabaseProjectTreeViewProvider) {
		this.projectTreeViewProvider = projTreeViewProvider;
	}

	public async openProject(projectFile: vscode.Uri) {
		console.log('Loading project: ' + projectFile.fsPath);

		// Read project file
		const newProject = new Project(projectFile.fsPath);
		await newProject.readProjFile();
		this.projects.push(newProject);

		// Read datasources.json (if present)
		const dataSourcesFilePath = path.join(path.dirname(projectFile.fsPath), constants.dataSourcesFileName);
		newProject.dataSources = await dataSources.load(dataSourcesFilePath);

		this.refreshProjectsTree();
	}

	public async createNewProject(newProjName: string, newProjUri: vscode.Uri) {
		const macroIndicator = '$$';

		const macroDict: Record<string, string> = {
			'PROJECT_NAME': newProjName,
			'PROJECT_GUID': Guid.create().toString()
		};

		let newProjFile = newSqlProjectTemplate;

		for (const macro in macroDict) {

			// check for values containing the macroIndicator, which could break macro expansion
			if (macroDict[macro].includes(macroIndicator)) {
				throw new Error(`New Project value ${macroDict[macro]} is invalid because it contains ${macroIndicator}`);
			}

			newProjFile.replace(macroIndicator + macro + macroIndicator, macroDict[macro]);
		}

		await fs.writeFile(newProjUri.fsPath, newProjFile);
	}

	public refreshProjectsTree() {
		this.projectTreeViewProvider.load(this.projects);
	}
}
