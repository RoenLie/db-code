import { Container } from 'inversify';
import type { ExtensionContext } from 'vscode';
import { CodeExplorerView } from '../code-explorer.ts';
import { DbCodeSourceControl } from '../code-source-control.ts';


export const createManifest = (vsContext: ExtensionContext) => {
	const container = new Container({ defaultScope: 'Transient' });
	container.bind('container')          .toConstantValue(container);
	container.bind('context')            .toConstantValue(vsContext);
	container.bind('code-explorer-view') .to(CodeExplorerView);
	container.bind('code-source-control').to(DbCodeSourceControl);

	return container;
};

//
