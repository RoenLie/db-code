import * as vscode from 'vscode';
import { Fiddle, DbCodeRepository } from './code-repository.ts';
import { existsSync, readFileSync } from 'fs';


class ChangeState {

	public isNew = false;
	public isDeleted = false;
	public isModified = false;
	public get state() {
		return this.isNew ? 'new'
			: this.isDeleted ? 'deleted'
				: 'modified';
	}

}


export class DbCodeSourceControl implements vscode.Disposable {

	private scm:              vscode.SourceControl;
	private changedResources: vscode.SourceControlResourceGroup;
	private repository:       DbCodeRepository;
	private _onRepositoryChange = new vscode.EventEmitter<any>();
	private timeout?:         NodeJS.Timeout;

	constructor(
		protected context: vscode.ExtensionContext,
		protected readonly workspaceFolder: vscode.WorkspaceFolder,
	) {
		this.scm = vscode.scm.createSourceControl('db-code', 'Db Code', workspaceFolder.uri);
		this.changedResources = this.scm.createResourceGroup('workingTree', 'Changes');
		this.repository = new DbCodeRepository(workspaceFolder);
		this.scm.quickDiffProvider = this.repository;
		this.scm.inputBox.placeholder = 'Message is ignored by JS Fiddle :-]';

		const fileSystemWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceFolder, '*.*'));
		fileSystemWatcher.onDidChange(uri => this.onResourceChange(uri), context.subscriptions);
		fileSystemWatcher.onDidCreate(uri => this.onResourceChange(uri), context.subscriptions);
		fileSystemWatcher.onDidDelete(uri => this.onResourceChange(uri), context.subscriptions);

		context.subscriptions.push(this.scm);
		context.subscriptions.push(fileSystemWatcher);

		this.tryUpdateChangedGroup();
	}

	private refreshStatusBar() {
		this.scm.statusBarCommands = [
			{
				command:   'extension.source-control.checkout',
				arguments: [ this ],
				title:     `↕ Here is a title`,
				tooltip:   'Checkout another version of this fiddle.',
			},
		];
	}

	public async commitAll(): Promise<void> {
		//if (!this.changedResources.resourceStates.length) {
		//	vscode.window.showErrorMessage('There is nothing to commit.');
		//}
		//else if (this.fiddle.version < this.latestFiddleVersion) {
		//	vscode.window.showErrorMessage('Checkout the latest fiddle version before committing your changes.');
		//}
		//else {
		//	const html = await this.getLocalResourceText('html');
		//	const js = await this.getLocalResourceText('js');
		//	const css = await this.getLocalResourceText('css');

		//	// here we assume nobody updated the Fiddle on the server since we refreshed the list of versions
		//	try {
		//		const newFiddle = await uploadFiddle(this.fiddle.slug, this.fiddle.version + 1, html, js, css);
		//		if (!newFiddle)
		//			return;

		//		this.setFiddle(newFiddle, false);
		//		this.jsFiddleScm.inputBox.value = '';
		//	}
		//	catch (ex) {
		//		vscode.window.showErrorMessage('Cannot commit changes to JS Fiddle. ' + ex.message);
		//	}
		//}
	}

	public get onRepositoryChange(): vscode.Event<Fiddle> {
		return this._onRepositoryChange.event;
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
		const changedResources: vscode.SourceControlResourceState[] = [];
		const uris = this.repository.provideSourceControlledResources();

		for (const localUri of uris) {
			const remoteUri = this.repository.provideOriginalResource(localUri);

			const state = new ChangeState();
			const remotePathExists = existsSync(remoteUri.fsPath);
			const localPathExists = existsSync(localUri.fsPath);

			if (!remotePathExists && localPathExists) {
				state.isNew = true;
				state.isModified = true;
			}
			else if (remotePathExists && localPathExists) {
				const remoteContent = readFileSync(remoteUri.fsPath, 'utf-8');
				const localContent = readFileSync(localUri.fsPath, 'utf-8');

				state.isModified = remoteContent.replace('\r', '') !== localContent.replace('\r', '');
			}
			else {
				state.isDeleted = true;
				state.isModified = true;
			}

			if (state.isModified) {
				const resourceState = this
					.toSourceControlResourceState(remoteUri, localUri, state);

				changedResources.push(resourceState);
			}
		}

		this.changedResources.resourceStates = changedResources;

		// the number of modified resources needs to be assigned to the SourceControl.count filed to let VS Code show the number.
		this.scm.count = this.changedResources.resourceStates.length;
	}

	public toSourceControlResourceState(
		remoteUri: vscode.Uri,
		localUri: vscode.Uri,
		state: ChangeState,
	): vscode.SourceControlResourceState {
		const original = state.isNew ? localUri : remoteUri;
		const local = state.isDeleted ? remoteUri : localUri;
		let title = localUri.path.split('Code/local').at(-1) + ' ↔ ';
		title += state.state.replace(/^\w/, str => str.toUpperCase());

		const resourceState: vscode.SourceControlResourceState = {
			resourceUri: localUri,
			command:     {
				title:     'Show changes',
				command:   'vscode.diff',
				arguments: [ original, local, title ],
			},
			decorations: {
				strikeThrough: state.isDeleted,
				// TODO
				// This is where we add icons depending on the state to show deleted, modified or new.
				iconPath:      vscode.Uri.joinPath(
					this.context.extensionUri,
					'resources',
					'light',
					'dependency.svg',
				),
			},
		};

		return resourceState;
	}

	/**
	 * Refresh is used when the information on the server may have changed.
	 * For example another user updates the Fiddle online.
	 */
	//async refresh(): Promise<void> {
	//	let latestVersion = this.fiddle.version || 0;
	//	while (true) {
	//		try {
	//			const latestFiddle = await downloadFiddle(this.fiddle.slug, latestVersion);
	//			this.latestFiddleVersion = latestVersion;
	//			latestVersion++;
	//		}
	//		catch (ex) {
	//			// typically the ex.statusCode == 404, when there is no further version
	//			break;
	//		}
	//	}

	//	this.refreshStatusBar();
	//}

	public dispose() {
		this._onRepositoryChange.dispose();
		this.scm.dispose();
	}

}
