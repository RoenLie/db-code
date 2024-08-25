import formidable from 'formidable';
import { Endpoint, method } from '../app/endpoint.ts';
import { maybe } from '@roenlie/core/async';
import { extract, list } from 'tar';
import { basename, join, sep } from 'node:path';
import { mkdir, rm, unlink } from 'node:fs/promises';


@method.get('/api/package/*')
export class GetPackage extends Endpoint {

	protected override handle() {
		console.log('get package');
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
			file.originalFilename?.split('.').slice(0, -1).join('.') ?? '',
		);

		const extractedPaths: string[] = [];

		await mkdir(targetDir, { recursive: true });
		await extract({
			file:        file.filepath,
			cwd:         targetDir,
			onReadEntry: (entry) => {
				extractedPaths.push(
					join(targetDir, entry.path.replace('/', sep)),
				);
			},
		});

		// Insert package into database.


		// Remove extracted files and the uploaded file.
		await rm(file.filepath);
		await rm(targetDir, { recursive: true });

		this.response.sendStatus(200);
	}

}


export default [
	GetPackage,
	InsertPackage,
];
