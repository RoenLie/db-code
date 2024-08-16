import type { QuickDiffProvider, WorkspaceFolder } from 'vscode';
import { Uri } from 'vscode';
import { globbySync } from 'globby';
import { join } from 'node:path/posix';
import RemoteContentProvider from './remote-content-provider.ts';


export class DbCodeRepository implements QuickDiffProvider {

	constructor(private workspaceFolder: WorkspaceFolder) { }

	protected scmIgnore: string[] = [
		//
		'tsconfig.json',
	];

	public provideOriginalResource(uri: Uri): Uri {
		const path = uri.path;
		let originalUri = uri;

		if (path.includes('local')) {
			originalUri = Uri.from({
				scheme: RemoteContentProvider.scheme,
				path:   path.replace('Code/local', 'Code/remote'),
			});
		}

		return originalUri;
	}

	/**
	 * Enumerates the resources under source control.
	 */
	public provideSourceControlledResources(): Uri[] {
		const pattern = join(this.workspaceFolder.uri.fsPath, '**').replaceAll('\\', '/');
		const files = globbySync(pattern, { onlyFiles: true });

		const filteredFiles = files.filter(file => {
			return !this.scmIgnore.some(pattern => file.includes(pattern));
		});

		return filteredFiles.map(file => Uri.file(file));
	}

}
