import * as vscode from 'vscode';

import { createManifest } from './inversify/container.ts';
import { DbCodeSourceControl } from './code-source-control.ts';
import { appName } from './paths.ts';
import { DbCodeDecorations } from './decoration-provider.ts';
import type RemoteContentProvider from './remote-content-provider.ts';


export async function activate(context: vscode.ExtensionContext) {
	const container = createManifest(context);
	container.get('code-explorer-view');

	const firstFolder = vscode.workspace.workspaceFolders?.[0];
	if (firstFolder?.uri.path.includes(appName)) {
		const scm = container.get<DbCodeSourceControl>('code-source-control');
		scm.initialize(firstFolder);

		const remoteContentProvider = container.get<RemoteContentProvider>('remote-content-provider');
		remoteContentProvider.initialize();

		const codeDecorations = container.get<DbCodeDecorations>('code-decorations');
		codeDecorations.initialize();
	}

	//new DomainSelector(context);

	//const rootPath = (vscode.workspace.workspaceFolders
	//	&& (vscode.workspace.workspaceFolders.length > 0))
	//	? vscode.workspace.workspaceFolders[0]!.uri.fsPath : undefined;

	// Samples of `window.registerTreeDataProvider`
	//const nodeDependenciesProvider = new DepNodeProvider(rootPath);
	//vscode.window.registerTreeDataProvider('nodeDependencies', nodeDependenciesProvider);
	//vscode.commands.registerCommand('nodeDependencies.refreshEntry', () => nodeDependenciesProvider.refresh());
	//vscode.commands.registerCommand('extension.openPackageOnNpm',    moduleName => vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`https://www.npmjs.com/package/${ moduleName }`)));
	//vscode.commands.registerCommand('nodeDependencies.addEntry',     () => vscode.window.showInformationMessage(`Successfully called add entry.`));
	//vscode.commands.registerCommand('nodeDependencies.editEntry',    (node: Dependency) => vscode.window.showInformationMessage(`Successfully called edit entry on ${ node.label }.`));
	//vscode.commands.registerCommand('nodeDependencies.deleteEntry',  (node: Dependency) => vscode.window.showInformationMessage(`Successfully called delete entry on ${ node.label }.`));

	// Samples of `window.createView`
	//new FtpExplorer(context);
	//new FileExplorer(context);

	//// Test View
	//new TestView(context);
	//new TestViewDragAndDrop(context);

	//const provider = new ColorsViewProvider(context.extensionUri);

	//context.subscriptions.push(
	//	vscode.window.registerWebviewViewProvider(ColorsViewProvider.viewType, provider),
	//);

	//context.subscriptions.push(
	//	vscode.commands.registerCommand('calicoColors.addColor', () => {
	//		provider.addColor();
	//	}),
	//);

	//context.subscriptions.push(
	//	vscode.commands.registerCommand('calicoColors.clearColors', () => {
	//		provider.clearColors();
	//	}),
	//);

	//context.subscriptions.push(vscode.commands.registerCommand('samples.quickInput', async () => {
	//	const options: Record<string, (context: vscode.ExtensionContext) => Promise<void>> = {
	//		showQuickPick,
	//		showInputBox,
	//		multiStepInput,
	//		quickOpen,
	//	};
	//	const quickPick = window.createQuickPick();
	//	quickPick.items = Object.keys(options).map(label => ({ label }));
	//	quickPick.onDidChangeSelection(selection => {
	//		if (selection[0]) {
	//			options[selection[0].label]!(context)
	//				.catch(console.error);
	//		}
	//	});
	//	quickPick.onDidHide(() => quickPick.dispose());
	//	quickPick.show();
	//}));
}
