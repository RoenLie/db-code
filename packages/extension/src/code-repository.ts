import type { CancellationToken, QuickDiffProvider, WorkspaceFolder } from 'vscode';
import { Uri } from 'vscode';
import { globbySync } from 'globby';
import { join } from 'node:path/posix';
import RemoteContentProvider from './remote-content-provider.ts';
import { isMatch } from 'micromatch';


export class DbCodeRepository implements QuickDiffProvider {

	public static emptyRemoteUri = Uri.from({
		scheme: RemoteContentProvider.scheme,
	});

	public static ignore: string[] = [
		'**/.dbcode',
		'**/tsconfig.json',
	];

	constructor() { }

	protected workspaceFolder: WorkspaceFolder;

	public initialize(workspaceFolder: WorkspaceFolder) {
		this.workspaceFolder = workspaceFolder;
	}

	public provideOriginalResource(uri: Uri, _token?: CancellationToken): Uri {
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
			.filter(file => !DbCodeRepository.ignore.some(pat => isMatch(file, pat)))
			.map(file => Uri.file(file));

		const filteredRemote = remoteFiles
			.filter(file => !DbCodeRepository.ignore.some(pat => isMatch(file, pat)))
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
