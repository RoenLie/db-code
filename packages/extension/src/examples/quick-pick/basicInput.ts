/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { window } from 'vscode';

/**
 * Shows a pick list using window.showQuickPick().
 */
export async function showQuickPick() {
	const domains: string[] = await fetch('http://localhost:42069/api/code/all-domains')
		.then(r => r.json());

	let i = 0;
	const result = await window.showQuickPick(domains, {
		placeHolder:     'select domain.',
		onDidSelectItem: item => window.showInformationMessage(`Focus ${ ++i }: ${ item }`),
	});
	window.showInformationMessage(`Got: ${ result }`);
}

/**
 * Shows an input box using window.showInputBox().
 */
export async function showInputBox() {
	const result = await window.showInputBox({
		value:          'abcdef',
		valueSelection: [ 2, 4 ],
		placeHolder:    'For example: fedcba. But not: 123',
		validateInput:  text => {
			window.showInformationMessage(`Validating: ${ text }`);

			return text === '123' ? 'Not 123!' : null;
		},
	});
	window.showInformationMessage(`Got: ${ result }`);
}
