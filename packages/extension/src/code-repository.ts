import type { QuickDiffProvider, WorkspaceFolder } from 'vscode';
import { Uri } from 'vscode';
import { globbySync } from 'globby';
import { join } from 'node:path/posix';
import RemoteContentProvider from './remote-content-provider.ts';


export class DbCodeRepository implements QuickDiffProvider {

	public static emptyRemoteUri = Uri.from({
		scheme: RemoteContentProvider.scheme,
	});

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
				path:   path.replace('Code/local', 'Corelde/remote'),
			});
		}

		return originalUri;
	}

	public provideLocalResource(uri: Uri): Uri {
		const path = uri.path;
		let localUri = uri;

		if (path.includes('remote'))
			localUri = Uri.file(path.replace('Code/remote', 'Code/local'));

		return localUri;
	}

	/**
	 * Enumerates the resources under source control.
	 */
	public provideSourceControlledResources(): { remote: Uri[], local: Uri[] } {
		const localPattern = join(this.workspaceFolder.uri.fsPath, '**').replaceAll('\\', '/');
		const localFiles = globbySync(localPattern, { onlyFiles: true });
		const remotePattern = localPattern.replace('Code/local', 'Code/remote');
		const remoteFiles = globbySync(remotePattern, { onlyFiles: true });

		const filteredLocal = localFiles
			.filter(file => !this.scmIgnore.some(pattern => file.includes(pattern)))
			.map(file => Uri.file(file));

		const filteredRemote = remoteFiles
			.filter(file => !this.scmIgnore.some(pattern => file.includes(pattern)))
			.map(file => Uri.from({
				scheme: RemoteContentProvider.scheme,
				path:   file,
			}));

		return {
			remote: filteredRemote,
			local:  filteredLocal,
		};
	}

}
