import { SQLite } from '../app/database.ts';
import type { CodeModule } from '../api/code.controller.ts';


export const moduleImportToParts = (importPath: string) => {
	const parts     = importPath.split('/');
	const domain    = parts[0]!;
	const subdomain = parts[1]!;
	const path      = parts.slice(2).join('/');

	return {
		domain,
		subdomain,
		path,
	};
};


export const getModule = (domain: string, subdomain: string, path: string) => {
	using db = new SQLite();
	const module = db.prepare<[string, string, string], { data: string }>(/* sql */`
	SELECT
		data
	FROM
		modules
	WHERE 1 = 1
		AND data ->> '$.tenant'    = 'core'
		AND data ->> '$.domain'    = (?)
		AND data ->> '$.subdomain' = (?)
		AND data ->> '$.path'      = (?)
	LIMIT
		1;
	`).get(domain, subdomain, path);

	if (!module)
		return;

	return JSON.parse(module.data) as CodeModule;
};


export const getAllModulesInSubdomain = (domain: string, subdomain: string) => {
	using db = new SQLite();
	const modules = db.prepare<[string, string], { data: string; }>(/* sql */`
		SELECT
			data
		FROM
			modules
		WHERE 1 = 1
			AND data ->> '$.tenant'    = 'core'
			AND data ->> '$.domain'    = (?)
			AND data ->> '$.subdomain' = (?);
		`).all(domain, subdomain)
		.map(r => JSON.parse(r.data) as CodeModule);

	return modules;
};
