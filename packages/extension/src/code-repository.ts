import type { QuickDiffProvider, WorkspaceFolder } from 'vscode';
import { Uri } from 'vscode';
import { globbySync } from 'globby';
import { join } from 'node:path/posix';


/** Represents one JSFiddle data and meta-data. */
export class Fiddle {

	constructor(public slug: string, public version: number) { }

}


export const JSFIDDLE_SCHEME = 'jsfiddle';

export class DbCodeRepository implements QuickDiffProvider {

	constructor(private workspaceFolder: WorkspaceFolder) { }

	protected scmIgnore: string[] = [
		//
		'tsconfig.json',
	];

	public provideOriginalResource(uri: Uri): Uri {
		const path = uri.path;
		let originalUri = uri;

		if (path.includes('local'))
			originalUri = Uri.file(path.replace('Code/local', 'Code/remote'));

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
