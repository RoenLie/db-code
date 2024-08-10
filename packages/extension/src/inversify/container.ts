import { Container } from 'inversify';
import type { ExtensionContext } from 'vscode';
import { CodeExplorerView } from '../code-explorer.ts';


export const createManifest = (vsContext: ExtensionContext) => {
	const container = new Container({ defaultScope: 'Transient' });
	container.bind('container')             .toConstantValue(container);
	container.bind('context')               .toConstantValue(vsContext);
	container.bind('code-explorer-view')    .to(CodeExplorerView);

	return container;
};
