import formidable from 'formidable';
import { Endpoint, method } from '../app/endpoint.ts';
import { maybe } from '@roenlie/core/async';
import { extract } from 'tar';
import { basename, join, sep } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { createPkgDepBuckets, createPkgNodeTree, insertPackageFromPaths } from '../services/package-service.ts';
import pacote from 'pacote';


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
	InsertPackage,
];
