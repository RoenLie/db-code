import type { Event, ExtensionContext, FileDecorationProvider } from 'vscode';
import { window, Uri, EventEmitter, FileDecoration, ThemeColor } from 'vscode';
import { inject, injectable } from './inversify/injectable.ts';
import type { SourceControlChangeState } from './code-source-control.ts';


@injectable()
export class DbCodeDecorationProvider implements FileDecorationProvider {

	constructor(
		@inject('context') protected context: ExtensionContext,
		@inject('source-change-state') protected sourceChangeState: SourceControlChangeState,
	) { }

	protected readonly _onDidChangeDecorations = new EventEmitter<Uri[]>();
	public get onDidChangeFileDecorations(): Event<Uri[]> {
		return this._onDidChangeDecorations.event;
	}

	protected deletedDecoration: FileDecoration = {
		badge:   'D',
		color:   new ThemeColor('gitDecoration.deletedResourceForeground'),
		tooltip: 'Deleted',
	};

	protected newDecoration: FileDecoration = {
		badge:   'N',
		color:   new ThemeColor('gitDecoration.addedResourceForeground'),
		tooltip: 'New',
	};

	protected modifiedDecoration: FileDecoration = {
		badge:   'M',
		color:   new ThemeColor('gitDecoration.modifiedResourceForeground'),
		tooltip: 'Modified',
	};

	public initialize() {
		this.context.subscriptions.push(window.registerFileDecorationProvider(this));
	}

	public requestNewFileDecorations(uris: Uri[]) {
		this._onDidChangeDecorations.fire(uris);
	}

	public provideFileDecoration(uri: Uri): FileDecoration | undefined {
		let decoration: FileDecoration | undefined;
		const state = this.sourceChangeState.get(uri.fsPath);

		if (state?.isDeleted)
			decoration = this.deletedDecoration;
		else if (state?.isNew)
			decoration = this.newDecoration;
		else if (state?.isModified)
			decoration = this.modifiedDecoration;

		return decoration;
	}

}
