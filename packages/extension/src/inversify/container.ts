import { Container } from 'inversify';
import type { ExtensionContext } from 'vscode';
import { CodeExplorerView as CodeExplorer } from '../code-explorer.ts';
import { DbCodeSourceControl } from '../code-source-control.ts';
import RemoteContentProvider from '../remote-content-provider.ts';
import { DbCodeDecorations } from '../decoration-provider.ts';


export const createManifest = (vsContext: ExtensionContext) => {
	const container = new Container({ defaultScope: 'Singleton' });
	container.bind('container')          .toConstantValue(container);
	container.bind('context')            .toConstantValue(vsContext);
	container.bind('code-explorer')      .to(CodeExplorer);
	container.bind('code-source-control').to(DbCodeSourceControl);
	container.bind('code-decorations')   .to(DbCodeDecorations);
	container.bind('remote-content-provider').to(RemoteContentProvider);

	return container;
};
