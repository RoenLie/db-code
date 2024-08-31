import * as vscode from 'vscode';
import { DbCodeRepository } from './code-repository.ts';
import { existsSync, readFileSync } from 'fs';
import { inject, injectable } from './inversify/injectable.ts';
import type { DbCodeDecorationProvider } from './decoration-provider.ts';


@injectable()
export class DbCodeSourceControl implements vscode.Disposable {

	constructor(
		@inject('context') protected context: vscode.ExtensionContext,
		@inject('code-decoration-provider') protected decorations: DbCodeDecorationProvider,
		@inject('source-change-state') protected sourceChangeState: SourceControlChangeState,
	) { }

	protected scm:              vscode.SourceControl;
	protected changedResources: vscode.SourceControlResourceGroup;
	protected repository:       DbCodeRepository;
	protected timeout?:         NodeJS.Timeout;
	protected workspaceFolder:  vscode.WorkspaceFolder;
	protected _onRepositoryChange = new vscode.EventEmitter<any>();
	public get onRepositoryChange(): vscode.Event<any> {
		return this._onRepositoryChange.event;
	}

	public initialize(workspaceFolder: vscode.WorkspaceFolder) {
		this.workspaceFolder = workspaceFolder;
		this.scm = vscode.scm.createSourceControl('dbCode', 'DBCode', workspaceFolder.uri);
		this.changedResources = this.scm.createResourceGroup('workingTree', 'Changes');
		this.repository = new DbCodeRepository();
		this.repository.initialize(workspaceFolder);
		this.scm.quickDiffProvider = this.repository;
		this.scm.inputBox.placeholder = 'Message';

		const context = this.context;
		const pattern = new vscode.RelativePattern(workspaceFolder, '**/*');
		const fileSystemWatcher = vscode.workspace.createFileSystemWatcher(pattern);

		fileSystemWatcher.onDidChange(uri => this.onResourceChange(uri), context.subscriptions);
		fileSystemWatcher.onDidCreate(uri => this.onResourceChange(uri), context.subscriptions);
		fileSystemWatcher.onDidDelete(uri => this.onResourceChange(uri), context.subscriptions);

		context.subscriptions.push(fileSystemWatcher);
		context.subscriptions.push(this);

		this.refresh();
	}

	public refresh() {
		this.tryUpdateChangedGroup();
		this.refreshStatusBar();
	}

	protected refreshStatusBar() {
		this.scm.statusBarCommands = [
			{
				command: 'dbCode.selectDomain',
				title:   `↕ Here is a title`,
				tooltip: 'Checkout another version of this fiddle.',
			},
		];
	}

	public onResourceChange(_uri: vscode.Uri): void {
		if (this.timeout)
			clearTimeout(this.timeout);

		this.timeout = setTimeout(() => this.tryUpdateChangedGroup(), 500);
	}

	public async tryUpdateChangedGroup(): Promise<void> {
		try {
			await this.updateChangedGroup();
		}
		catch (ex) {
			console.error(ex);
			vscode.window.showErrorMessage(ex as string);
		}
	}

	/** This is where the source control determines, which documents were updated, removed, or added. */
	public async updateChangedGroup(): Promise<void> {
		// for simplicity we ignore which document was changed in this event and scan all of them
		const newChangeState = new SourceControlChangeState();
		const changedResources: vscode.SourceControlResourceState[] = [];
		const changedStates: ChangeState[] = [];

		const { local, remote } = this.repository.provideSourceControlledResources();

		// Iterate through all local files to check if they have been modified
		// or new files have been created.
		for (const localUri of local) {
			const remoteUri = this.repository.provideOriginalResource(localUri);

			const state = new ChangeState(localUri);
			const remotePathExists = existsSync(remoteUri.fsPath);

			if (remotePathExists) {
				const remoteContent = readFileSync(remoteUri.fsPath, 'utf-8');
				const localContent = readFileSync(localUri.fsPath, 'utf-8');

				state.isModified = remoteContent.replace('\r', '') !== localContent.replace('\r', '');

				// Remove the remote uri so that we don't iterate over it when checking for
				// deleted files later.
				remote.splice(remote.findIndex(r => r.fsPath === remoteUri.fsPath), 1);
			}
			else {
				state.isNew = true;
				state.isModified = true;
			}

			if (state.isModified) {
				const resourceState = this.toSourceControlResourceState(remoteUri, localUri, state);
				changedResources.push(resourceState);
				newChangeState.set(localUri.fsPath, state);
			}

			// Check if it has changed.
			const previousState = this.sourceChangeState.get(localUri.fsPath);
			if (!previousState?.compare(state))
				changedStates.push(state);
		}

		// Iterate the remote Uris for files which have been deleted from local.
		// This list has been reduced in length by trimming entries already checked above.
		for (const remoteUri of remote) {
			const localUri = this.repository.provideLocalResource(remoteUri);

			const state = new ChangeState(localUri);
			state.isDeleted = true;

			const resourceState = this.toSourceControlResourceState(remoteUri, localUri, state);
			changedResources.push(resourceState);
			newChangeState.set(localUri.fsPath, state);

			// Check if it has changed.
			const previousState = this.sourceChangeState.get(localUri.fsPath);
			if (!previousState?.compare(state))
				changedStates.push(state);
		}

		this.changedResources.resourceStates = changedResources;

		// the number of modified resources needs to be assigned to the SourceControl.count
		// filed to let VS Code show the number.
		this.scm.count = this.changedResources.resourceStates.length;

		// Assign the new change state so that any future code uses the correct state.
		this.sourceChangeState.replace(newChangeState);

		// Request file decoration provider to get new file decorations for the changed files.
		if (changedStates.length)
			this.decorations.requestNewFileDecorations(changedStates.map(state => state.uri));


		console.log('something updated');
	}

	public toSourceControlResourceState(
		remoteUri: vscode.Uri,
		localUri: vscode.Uri,
		state: ChangeState,
	): vscode.SourceControlResourceState {
		const local = state.isDeleted ? DbCodeRepository.emptyRemoteUri : localUri;
		let title = localUri.path.split('Code/local').at(-1) + ' ↔ ';
		title += state.state.replace(/^\w/, str => str.toUpperCase());

		const resourceState: vscode.SourceControlResourceState = {
			resourceUri: localUri,
			command:     {
				title:     'Show changes',
				command:   'vscode.diff',
				arguments: [ remoteUri, local, title ],
			},
			decorations: {
				strikeThrough: state.isDeleted,
				faded:         false,
			},
		};

		return resourceState;
	}

	public dispose() {
		this._onRepositoryChange.dispose();
		this.scm.dispose();
	}

}


@injectable()
export class SourceControlChangeState extends Map<string, ChangeState> {

	public domain = '';
	public subdomain = '';

	public replace(changestate: SourceControlChangeState) {
		this.clear();
		changestate.forEach((state, key) => this.set(key, state));
	}

}


export class ChangeState {

	constructor(
		public uri: vscode.Uri,
	) {
		const fullPath = uri.path.split('Code/local/').at(-1) ?? '';
		const parts = fullPath.split('/');

		this.domain = parts.splice(0, 1).at(0)!;
		this.subdomain = parts.splice(0, 1).at(0)!;
		this.path = parts.join('/');
	}

	public readonly domain:    string;
	public readonly subdomain: string;
	public readonly path:      string;
	public isNew = false;
	public isDeleted = false;
	public isModified = false;
	public get state(): 'new' | 'deleted' | 'modified' | '' {
		if (this.isNew)
			return 'new';
		if (this.isDeleted)
			return 'deleted';
		if (this.isModified)
			return 'modified';

		return '';
	}

	public compare(state: ChangeState) {
		return this.uri.fsPath === state.uri.fsPath
			&& this.state === state.state;
	}

}
