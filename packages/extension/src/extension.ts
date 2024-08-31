import * as vscode from 'vscode';

import { createManifest } from './inversify/container.ts';
import { DbCodeSourceControl, SourceControlChangeState } from './code-source-control.ts';
import { appName } from './paths.ts';
import type RemoteContentProvider from './remote-content-provider.ts';
import { CodeExplorerView } from './code-explorer.ts';
import type { DbCodeDecorationProvider } from './decoration-provider.ts';
import { readFileSync } from 'fs';


export async function activate(context: vscode.ExtensionContext) {
	const container = createManifest(context);
	container.get<CodeExplorerView>('code-explorer')
		.initialize();

	context.subscriptions.push(vscode.commands.registerCommand(
		'dbCode.source-control.commit',
		async (_sourceControlPane: vscode.SourceControl) => {
			const changeState = container.get<SourceControlChangeState>('source-change-state');

			const promises: Promise<any>[] = [];

			changeState.forEach(value => {
				const url = new URL('', 'http://localhost:42069');
				url.searchParams.set('domain', value.domain);
				url.searchParams.set('subdomain', value.subdomain);
				url.searchParams.set('path', value.path);

				if (value.isDeleted) {
					url.pathname = '/api/code/module/delete';
					promises.push(fetch(url, {
						method: 'DELETE',
					}));
				}
				else if (value.isNew || value.isModified) {
					url.pathname = '/api/code/module/upsert';
					promises.push(fetch(url, {
						method:  'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ data: readFileSync(value.uri.fsPath, 'utf-8') }),
					}));
				}
			});

			await Promise.allSettled(promises);

			const ce = container.get<CodeExplorerView>('code-explorer');
			await ce.pullFromRemote();

			const scm = container.get<DbCodeSourceControl>('code-source-control');
			await scm.tryUpdateChangedGroup();
		},
	));

	const firstFolder = vscode.workspace.workspaceFolders?.[0];
	if (firstFolder?.uri.path.includes(appName)) {
		const scm = container.get<DbCodeSourceControl>('code-source-control');
		scm.initialize(firstFolder);

		const rcp = container.get<RemoteContentProvider>('remote-content-provider');
		rcp.initialize();

		const cdp = container.get<DbCodeDecorationProvider>('code-decoration-provider');
		cdp.initialize();
	}
}
