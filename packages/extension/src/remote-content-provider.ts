import { type TextDocumentContentProvider, type Disposable, type ExtensionContext, type Uri, type Event, workspace } from 'vscode';
import { inject, injectable } from './inversify/injectable.ts';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';


@injectable()
export default class RemoteContentProvider implements TextDocumentContentProvider, Disposable {

	public static scheme = 'dbcode-remote';

	constructor(
		@inject('context') protected context: ExtensionContext,
	) { }

	public initialize() {
		this.context.subscriptions.push(
			workspace.registerTextDocumentContentProvider(RemoteContentProvider.scheme, this),
		);
	}

	public dispose() {
		throw new Error('Method not implemented.');
	}

	public onDidChange?: Event<Uri> | undefined;

	public async provideTextDocumentContent(uri: Uri): Promise<string | null> {
		if (!existsSync(uri.fsPath))
			return '';

		return await readFile(uri.fsPath, 'utf-8');
	}

}
