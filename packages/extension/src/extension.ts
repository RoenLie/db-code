import * as vscode from 'vscode';

import { createManifest } from './inversify/container.ts';
import { DbCodeSourceControl } from './code-source-control.ts';
import { appName } from './paths.ts';
import type RemoteContentProvider from './remote-content-provider.ts';
import { CodeExplorerView } from './code-explorer.ts';
import type { DbCodeDecorationProvider } from './decoration-provider.ts';


export async function activate(context: vscode.ExtensionContext) {
	const container = createManifest(context);
	container.get<CodeExplorerView>('code-explorer')
		.initialize();

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
