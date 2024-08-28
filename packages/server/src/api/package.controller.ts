import formidable from 'formidable';
import { Endpoint, method } from '../app/endpoint.ts';
import { maybe } from '@roenlie/core/async';
import { extract } from 'tar';
import { basename, join, sep } from 'node:path';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { SQLite } from '../app/database.ts';


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
		await insertPackage(extractedPaths);

		// Remove extracted files and the uploaded file.
		await rm(file.filepath);
		await rm(targetDir, { recursive: true });

		this.response.sendStatus(200);
	}

}


const insertPackage = async (paths: string[]) => {
	using db = new SQLite();

	const transaction = db.transaction(async () => {
		db.exec(/* sql */`
		CREATE TABLE IF NOT EXISTS packages (
			id INTEGER PRIMARY KEY,
			path TEXT DEFAULT '' NOT NULL,
			content TEXT DEFAULT '' NOT NULL
		);
		`);

		db.exec(/* sql */`
		DELETE FROM packages
		`);

		const insert = db.prepare(/* sql */`
		INSERT INTO packages (path, content)
		VALUES (?, ?)
		`);

		const packagePath = paths.find(path => path.endsWith('package.json'));
		if (!packagePath)
			return console.error('No package json found, cannot continue.');

		const packageJson = await readFile(packagePath, 'utf-8');
		const packageObj = JSON.parse(packageJson) as {
			name:             string;
			version:          string;
			// TODO need to traverse these and download the tarball.
			// Then repeat the insertion code that we are doing here.
			dependencies:     Record<string, string>;
			peerDependencies: Record<string, string>;
		};
		const packageName = packageObj.name;
		const packageVersion = packageObj.version;

		for await (let path of paths) {
			// Get the content of the file prior to mutating the path.
			const content = await readFile(path, 'utf-8');

			// replace all windows seperators with posixs
			path = path.replaceAll('\\', '/');
			// get path without the part of this systems temp folder.
			path = path.split('package/').at(-1)!;
			// add package name and version infront of the path.
			path = packageName + '/' + packageVersion + '/' + path;

			insert.run(path, content);
		}
	});

	await transaction();
};


export default [
	GetPackage,
	InsertPackage,
];
