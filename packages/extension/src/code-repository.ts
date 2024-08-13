import type { QuickDiffProvider, CancellationToken, ProviderResult, WorkspaceFolder } from 'vscode';
import { Uri, workspace, window, env } from 'vscode';
import * as path from 'path';
import { globbySync } from 'globby';
import { paths } from './paths.ts';
import { join } from 'node:path/posix';


/** Represents one JSFiddle data and meta-data. */
export class Fiddle {

	constructor(public slug: string, public version: number, public data: FiddleData) { }

}

/** Represents JSFiddle HTML, JavaScript and CSS text. */
export interface FiddleData {
	html: string;
	js:   string;
	css:  string;
}

export function areIdentical(first: FiddleData, second: FiddleData): boolean {
	return first.html === second.html
		&& first.css === second.css
		&& first.js === second.js;
}

export const JSFIDDLE_SCHEME = 'jsfiddle';

export class DbCodeRepository implements QuickDiffProvider {

	constructor(private workspaceFolder: WorkspaceFolder) { }

	public provideOriginalResource?(uri: Uri, _token: CancellationToken): ProviderResult<Uri> {
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

		return files.map(file => Uri.file(file));
	}

}
