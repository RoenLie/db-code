import vscode from 'vscode';


export class DomainSelector {

	constructor(context: vscode.ExtensionContext) {
		const provider = new DomainSelectorProvider();

		const providerDisposable = vscode.window.registerTreeDataProvider('dbCodeDomainSelector', provider);
		context.subscriptions.push(providerDisposable);

		const tree = vscode.window.createTreeView('dbCodeDomainSelector', {
			treeDataProvider: provider,
			showCollapseAll:  true,
		});

		// setup: events
		tree.onDidChangeSelection(e => {
			console.log(e); // breakpoint here for debug
		});
		tree.onDidCollapseElement(e => {
			console.log(e); // breakpoint here for debug
		});
		tree.onDidChangeVisibility(e => {
			console.log(e); // breakpoint here for debug
		});
		tree.onDidExpandElement(e => {
			console.log(e); // breakpoint here for debug
		});

		context.subscriptions.push(tree);
	}

}


export class DomainNode {

	value: string;

}


export class DomainSelectorProvider implements vscode.TreeDataProvider<DomainNode> {

	public onDidChangeTreeData?: vscode.Event<void | DomainNode | DomainNode[] | null | undefined> | undefined;
	public getTreeItem(element: DomainNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return {
			label: element.value,
		};
	}

	public async getChildren(element?: DomainNode | undefined): Promise<DomainNode[]> {
		return vscode.window.withProgress({ location: { viewId: 'dbCodeDomainSelector' } }, () => {
			return (async () => {
				try {
					const response: string[] = await fetch('http://localhost:42069/api/code/all-domains').then(r => r.json());

					return response.map(value => ({ value }));
				}
				catch (err) {
					console.error(err);

					return [];
				}
			})();
		});
	}

	public getParent?(element: DomainNode): vscode.ProviderResult<DomainNode> {
		//throw new Error('Method not implemented.');

		return undefined;
	}

}
