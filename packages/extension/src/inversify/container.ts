import { Container } from 'inversify';
import type { ExtensionContext } from 'vscode';
import { CodeExplorerView as CodeExplorer } from '../code-explorer.ts';
import { DbCodeSourceControl, SourceControlChangeState } from '../code-source-control.ts';
import RemoteContentProvider from '../remote-content-provider.ts';
import { DbCodeDecorationProvider } from '../decoration-provider.ts';


export const createManifest = (vsContext: ExtensionContext) => {
	const container = new Container({ defaultScope: 'Singleton', skipBaseClassChecks: true });
	container.bind('container')          .toConstantValue(container);
	container.bind('context')            .toConstantValue(vsContext);
	container.bind('code-explorer')      .to(CodeExplorer);
	container.bind('code-source-control').to(DbCodeSourceControl);
	container.bind('source-change-state').to(SourceControlChangeState);
	container.bind('code-decoration-provider').to(DbCodeDecorationProvider);
	container.bind('remote-content-provider') .to(RemoteContentProvider);

	return container;
};
