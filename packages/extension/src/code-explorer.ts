import './paths.ts';
import { Uri, window, commands, workspace } from 'vscode';
import type { ExtensionContext } from 'vscode';
import { inject, injectable } from './inversify/injectable.ts';
import { basename, dirname, join } from 'node:path/posix';
import { paths } from './paths.ts';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { $ } from './exec-shell.ts';
import { existsSync } from 'node:fs';
import { globby } from 'globby';
import type { Container } from 'inversify';
import { DbCodeRepository } from './code-repository.ts';
import { isMatch } from 'micromatch';


interface Module {
	domain:    string;
	subdomain: string;
	path:      string;
	content:   string;
}


@injectable()
export class CodeExplorerView {

	constructor(
		@inject('context') protected vsContext: ExtensionContext,
		@inject('container') protected container: Container,
	) { }

	protected domainMap = new Map<string, string[]>();

	public initialize() {
		this.vsContext.subscriptions.push(
			commands.registerCommand('dbCode.selectDomain', this.showSelectDomainPicker, this),
		);
	}

	protected async updateDomainsAndSubdomains(): Promise<Map<string, string[]>> {
		const url = new URL('/api/code/domains-and-subdomains', 'http://localhost:42069');

		const domainsAndSubdomains: [string, string[]][] = await fetch(url).then(r => r.json());
		this.domainMap = new Map(domainsAndSubdomains);

		return this.domainMap;
	}

	protected async getModules(domain: string, subdomain: string): Promise<Module[]> {
		const url = new URL('/api/code/module', 'http://localhost:42069');
		url.search = `domain=${ domain }&subdomain=${ subdomain }`;

		const modules: Module[] = await fetch(url).then(r => r.json());

		return modules;
	}

	protected async updateRemoteAndEnsureLocal(
		remoteDir: string,
		localDir: string,
		modules: Module[],
		replaceLocal?: boolean,
	) {
		const existingRemoteGlob = await globby(remoteDir + '/**', { onlyFiles: true });
		let existingRemotePaths: string[] = [];

		for (const path of existingRemoteGlob)
			existingRemotePaths.push(path);

		const existingLocalGlob = await globby(localDir + '/**', { onlyFiles: true });
		let existingLocalPaths: string[] = [];

		for (const path of existingLocalGlob)
			existingLocalPaths.push(path);

		await Promise.allSettled(modules.map(async m => {
			const remoteFileDir = join(remoteDir, dirname(m.path));
			const localFileDir = join(localDir, dirname(m.path));

			const remoteFilePath = join(remoteFileDir, basename(m.path));
			const localFilePath = join(localFileDir, basename(m.path));

			await mkdir(remoteFileDir, { recursive: true });
			await writeFile(remoteFilePath, m.content, 'utf-8');

			await mkdir(localFileDir, { recursive: true });

			if (!existsSync(localFilePath) || replaceLocal)
				await writeFile(localFilePath, m.content, 'utf-8');

			const remoteExists = existingRemotePaths.indexOf(remoteFilePath);
			const localExists = existingLocalPaths.indexOf(localFilePath);
			existingLocalPaths.splice(localExists, 1);
			existingRemotePaths.splice(remoteExists, 1);
		}));

		existingRemotePaths = existingRemotePaths
			.filter(p => !DbCodeRepository.ignore.some(pat => isMatch(p, pat)));
		existingLocalPaths = existingLocalPaths
			.filter(p => !DbCodeRepository.ignore.some(pat => isMatch(p, pat)));

		await Promise.allSettled(existingRemotePaths.map(async path => {
			await unlink(path);
		}));

		if (replaceLocal) {
			await Promise.allSettled(existingLocalPaths.map(async path => {
				await unlink(path);
			}));
		}
	}

	protected async showSelectDomainPicker() {
		const domains = await this.updateDomainsAndSubdomains();
		const domain = await window.showQuickPick(
			[ ...domains.keys() ],
			{ placeHolder: 'select domain.' },
		);

		if (!domain)
			return;

		const subdomain = await window.showQuickPick(
			domains.get(domain) ?? [],
			{ placeHolder: 'select subdomain.' },
		);

		if (!subdomain)
			return;

		window.showInformationMessage(`Selecting: ${ domain }:${ subdomain }`);

		const modules = await this.getModules(domain, subdomain);

		const remoteDir = join(paths.code, 'remote', domain, subdomain);
		const localDir = join(paths.code, 'local', domain, subdomain);

		await this.updateRemoteAndEnsureLocal(
			remoteDir, localDir, modules, true,
		);

		const rootPath = workspace.workspaceFolders?.[0]?.uri.fsPath
			?.replaceAll('\\', '/').toLowerCase();

		const workspacePath = join(paths.code, 'db-code.code-workspace');
		await this.createConfigFiles(workspacePath, localDir);

		const isInWorkspace = rootPath?.startsWith(paths.code.toLowerCase());
		if (!isInWorkspace) {
			await $`cd ${ paths.code } && pnpm i`;

			commands.executeCommand('vscode.openFolder', Uri.file(workspacePath));
		}
		else {
			const folder = {
				uri: Uri.file(localDir),
			} as {
				readonly uri:   Uri;
				readonly name?: string;
			};

			await $`cd ${ paths.code } && pnpm i`;

			workspace.updateWorkspaceFolders(
				0,
				workspace.workspaceFolders?.length,
				folder,
			);
		}
	}

	public async createConfigFiles(
		workspacePath: string,
		localDir: string,
	) {
		await writeFile(workspacePath, JSON.stringify({
			folders:  [ { path: localDir } ],
			settings: {
				'editor.bracketPairColorization.enabled': true,
				'editor.guides.bracketPairs':             'active',
				'editor.formatOnSave':                    true,
				'editor.codeActionsOnSave':               {
					'source.fixAll.eslint': 'explicit',
				},
				'editor.detectIndentation':  false,
				'editor.insertSpaces':       false,
				'eslint.workingDirectories': [
					{
						'mode': 'auto',
					},
				],
				'eslint.run':                                         'onType',
				'eslint.useESLintClass':                              true,
				'eslint.useFlatConfig':                               true,
				'eslint.format.enable':                               true,
				'eslint.validate':                                    [ 'typescript' ],
				'typescript.tsdk':                                    join(paths.code, 'node_modules', 'typescript', 'lib'),
				'typescript.preferences.quoteStyle':                  'single',
				'typescript.preferences.importModuleSpecifierEnding': 'js',
				'typescript.format.insertSpaceAfterTypeAssertion':    true,
				'typescript.format.semicolons':                       'insert',
				'typescript.updateImportsOnFileMove.enabled':         'always',
				'typescript.preferences.importModuleSpecifier':       'non-relative',
				'[typescript]':                                       {
					'editor.defaultFormatter': 'dbaeumer.vscode-eslint',
				},
				'files.exclude': {
					'**/tsconfig.json': true,
					'**/.dbcode':       true,
				},
			},
		}, undefined, '\t'), 'utf-8');

		await writeFile(join(paths.code, 'package.json'), JSON.stringify({
			name:            'db-code',
			private:         true,
			description:     '',
			authors:         '',
			version:         '1.0.0',
			main:            '',
			type:            'module',
			dependencies:    {},
			devDependencies: {
				'@roenlie/eslint-config': '^1.3.3',
				'@roenlie/tsconfig':      '^1.0.5',
				'tslib':                  '^2.6.3',
				'typescript':             '^5.5.4',
			},
		}, undefined, '\t'), 'utf-8');

		await writeFile(join(paths.code, 'eslint.config.js'), `
		import eslintConfig from '@roenlie/eslint-config';

		export default eslintConfig.all;
		`, 'utf-8');

		await writeFile(join(paths.code, 'tsconfig.json'), JSON.stringify({
			extends:         '@roenlie/tsconfig',
			compilerOptions: {
				baseUrl:             './local',
				rootDir:             './local',
				noEmit:              true,
				emitDeclarationOnly: false,
				'paths':             [ ...this.domainMap ].reduce(
					(acc, [ domain, subdomains ]) => {
						subdomains.forEach(subdomain =>
							acc[`${ domain }:${ subdomain }/*`] = [ join(domain, subdomain, '*') ]);

						return acc;
					},
					{} as Record<string, string[]>,
				),
			},
			include: [
				'./**/*.ts',
				'./**/*.d.ts',
			],
			exclude: [
				'remote',
				'node_modules',
			],
		}, undefined, '\t'), 'utf-8');

		await writeFile(join(localDir, 'tsconfig.json'), JSON.stringify({
			extends: '../../../tsconfig.json',
		}, undefined, '\t'), 'utf-8');

		await writeFile(join(localDir, '.dbcode'), ``, 'utf-8');
	}

	public async pullFromRemote() {
		const workspaceFolder = workspace.workspaceFolders![0]!;
		const domainSegment = workspaceFolder.uri.path.split('Code/local/').at(-1)!;
		const [ domain, subdomain ] = domainSegment.split('/') as [string, string];

		window.showInformationMessage(`Pulling from remote: ${ domain }:${ subdomain }`);

		const modules = await this.getModules(domain, subdomain);

		const remoteDir = join(paths.code, 'remote', domain, subdomain);
		const localDir = join(paths.code, 'local', domain, subdomain);

		await this.updateRemoteAndEnsureLocal(
			remoteDir, localDir, modules, true,
		);
	}

}
