import { readFile } from 'node:fs/promises';
import { SQLite } from '../app/database.ts';
import pacote from 'pacote';
import { maybe } from '@roenlie/core/async';


export const test = () => {};


export const insertPackageFromPaths = async (paths: string[]) => {
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
			name:    string;
			version: string;
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


export const createPackageTree = (name: string, version: string) => {


};


interface Node {
	name:    string;
	version: string;
	deps:    Node[];
};


export const createPkgNodeTree = async (name: string, version: string) => {
	const rootNode: Node = { name, version, deps: [] };

	const visitedNodes = new WeakSet<Node>();
	const nodeQueue: Node[] = [ rootNode ];
	while (nodeQueue.length) {
		const node = nodeQueue.shift()!;
		if (visitedNodes.has(node) && visitedNodes.add(node))
			continue;

		const [ pkg, err ] = await maybe(
			pacote.manifest(`${ node.name }@${ node.version }`),
		);

		if (err)
			continue;

		for (const [ name, version ] of Object.entries(pkg.dependencies ?? {})) {
			const newNode: Node = { name, version, deps: [] };

			node.deps.push(newNode);
			nodeQueue.push(newNode);
		}
	}

	return rootNode;
};


export const createPkgDepBuckets = (
	node: Node,
	dependencies: string[][] = [],
	visitedNodes = new WeakSet<Node>(),
	depth = 0,
) => {
	if (visitedNodes.has(node) && visitedNodes.add(node))
		return dependencies;

	if (node.deps.length) {
		for (const child of node.deps)
			createPkgDepBuckets(child, dependencies, visitedNodes, depth + 1);
	}

	const arr = dependencies[depth] ?? (dependencies[depth] = []);
	arr.push(node.name + '@' + node.version);

	return dependencies;
};
