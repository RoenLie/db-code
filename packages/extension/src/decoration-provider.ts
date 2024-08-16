import type { Event, ExtensionContext, FileDecorationProvider } from 'vscode';
import { window, Uri, Disposable, EventEmitter, FileDecoration, ThemeColor } from 'vscode';
import { inject, injectable } from './inversify/injectable.ts';


@injectable()
export class DbCodeDecorations {

	private disposables: Disposable[] = [];

	constructor(
		@inject('context') protected context: ExtensionContext,
	) {}

	public initialize() {
		this.context.subscriptions.push(this);
		this.disposables.push(
			new DbCodeDecorationProvider(),
		);
	}

	public dispose(): void {
		this.disposables.forEach(d => d.dispose());
		this.disposables.length = 0;
	}

}


class DbCodeDecorationProvider implements FileDecorationProvider {

	private readonly _onDidChangeDecorations = new EventEmitter<Uri[]>();
	public readonly onDidChangeFileDecorations: Event<Uri[]> = this._onDidChangeDecorations.event;

	private disposables: Disposable[] = [];

	constructor() {
		this.disposables.push(
			window.registerFileDecorationProvider(this),
		);
	}

	public provideFileDecoration(uri: Uri): FileDecoration | undefined {
		console.log('ASKING FOR FILE DECORATION', uri);

		return {
			badge:   'M',
			color:   new ThemeColor('gitDecoration.modifiedResourceForeground'),
			tooltip: 'Modified',
		};
	}

	public dispose(): void {
		this.disposables.forEach(d => d.dispose());
		this.disposables.length = 0;
	}

}
