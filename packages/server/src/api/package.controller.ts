import formidable from 'formidable';
import { Endpoint, method } from '../app/endpoint.ts';
import { maybe } from '@roenlie/core/async';
import { extract, t } from 'tar';
import { basename, dirname, join, sep } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { createPkgDepBuckets, createPkgNodeTree, insertPackageContents, insertPackageFromPaths } from '../services/package-service.ts';
import pacote from 'pacote';
import { paths } from '../app/paths.ts';
import { join as posixJoin, dirname as posixDirname } from 'node:path/posix';


@method.get('/api/package/*')
export class GetPackage extends Endpoint {

	protected override handle() {
		console.log('get package');
	}

}

@method.get('/api/package/install')
export class InstallPackage extends Endpoint {

	protected override async handle() {
		const { name, version = 'latest' } = this.request.query as {
			name?:    string;
			version?: string;
		};

		if (!name)
			return this.response.sendStatus(404);

		const nodeTree = await createPkgNodeTree(name, version);
		const buckets = createPkgDepBuckets(nodeTree);

		const depLineage = buckets.reduceRight((acc, cur) => {
			cur.forEach(dep => acc.add(dep));

			return acc;
		}, new Set<string>());

		for (const spec of depLineage) {
			const splitSpec = spec.split('@');
			const name = splitSpec.slice(0, -1).join('@');
			const version = splitSpec.at(-1)!;

			const dirPath = posixJoin(paths.cache, 'packages');
			const fileName = spec.replaceAll('/', '_');
			const filePath = posixJoin(dirPath, fileName + '.tgz');

			console.log('Downloading and extracking package', {
				dirPath, fileName, filePath, name, version,
			});

			try {
				await mkdir(dirPath, { recursive: true });
				await pacote.tarball.file(spec, filePath);

				const files: Promise<{ path: string; content: string; }>[] = [];

				await t({
					file: filePath,
					async onReadEntry(entry) {
						if (entry.path.endsWith('/'))
							return;

						files.push(entry.collect().then(([ buffer ]) => {
							return {
								path:    entry.path,
								content: buffer?.toString() ?? '',
							};
						}));
					},
				});

				const resolvedFiles = await Promise.all(files);
				const pkgJsonPath = resolvedFiles.find(file => file.path.endsWith('package.json'))?.path;
				if (pkgJsonPath) {
					const pathPrefix = posixDirname(pkgJsonPath);
					resolvedFiles.forEach(file => {
						file.path = file.path.replace(pathPrefix, '');
					});

					insertPackageContents(name, version, resolvedFiles);
				}
				else {
					console.error(
						'Skipping insertion of',
						name, version,
						'Could not find package.json.',
						'Possible malformed package?',
					);
				}

				// Remove extracted files and the uploaded file.
				await rm(filePath);
			}
			catch (err) {
				console.error(err);

				return this.response.sendStatus(500);
			}
		}

		return this.response.send([ ...depLineage ]);
	}

}


@method.post('/api/package/insert')
export class InsertPackage extends Endpoint {

	protected override async handle() {
		const form = formidable();

		const [ result, error ] = await maybe(form.parse(this.request));
		if (error)
			return console.error(error), this.next();

		const [ , files ] = result;
		const file = Object.values(files).map(file => file![0]!).at(0)!;

		const tempPath = file.filepath.replace(basename(file.filepath), '');
		const targetDir = join(
			tempPath,
			file.originalFilename?.replace('.', '_') ?? '',
		);

		const extractedPaths: string[] = [];

		await mkdir(targetDir, { recursive: true });
		await extract({
			file:        file.filepath,
			cwd:         targetDir,
			onReadEntry: (entry) => {
				extractedPaths.push(join(targetDir, entry.path.replaceAll('/', sep)));
			},
		});

		// Insert package into database.
		await insertPackageFromPaths(extractedPaths);

		// Remove extracted files and the uploaded file.
		await rm(file.filepath);
		await rm(targetDir, { recursive: true });

		this.response.sendStatus(200);
	}

}


export default [
	GetPackage,
	InstallPackage,
	//InsertPackage,
];
