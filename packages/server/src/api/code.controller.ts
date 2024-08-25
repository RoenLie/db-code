import { SQLite } from '../app/database.ts';
import { Endpoint, method } from '../app/endpoint.ts';
import { createCacheSlug, tsCache } from '../services/transpile-ts.ts';
import { getAllModulesInSubdomain, getModule } from '../services/module-service.ts';


export interface CodeModule {
	tenant:     string;
	type:       string;
	domain:     string;
	subdomain:  string;
	path:       string;
	content:    string;
	created_at: string;
	updated_at: string;
}


@method.get('/api/code/all')
class GetAllPaths extends Endpoint {

	protected override handle(): any | Promise<any> {
		using db = new SQLite();

		const files = db.prepare<unknown[], { data: string; }>(/* sql */`
		SELECT data
		FROM modules;
		`).all().map(r => JSON.parse(r.data));

		this.response.send(files);
	}

}


@method.get('/api/code/domain')
class GetAllDomains extends Endpoint {

	protected override handle(): any | Promise<any> {
		using db = new SQLite();

		const files = db.prepare<unknown[], { domain: string; }>(/* sql */`
		SELECT DISTINCT
			data ->> '$.domain' as domain
		FROM
			modules
		WHERE
			data ->> '$.tenant' = 'core';
		`).all().map(r => r.domain);

		this.response.send(files);
	}

}


@method.get('/api/code/subdomain')
class GetSubdomains extends Endpoint {

	protected override handle(): any | Promise<any> {
		const { domain } = this.request.query as {
			domain: string;
		};

		using db = new SQLite();

		const files = db.prepare<unknown[], { subdomain: string; }>(/* sql */`
		SELECT DISTINCT
			data ->> '$.subdomain' as subdomain
		FROM
			modules
		WHERE 1 = 1
			AND data ->> '$.tenant' = 'core'
			AND data ->> '$.domain' = (?);
		`).all(domain).map(r => r.subdomain);

		this.response.send(files);
	}

}


@method.get('/api/code/domains-and-subdomains')
class GetAllDomainsAndSubdomains extends Endpoint {

	protected override handle(): any | Promise<any> {
		using db = new SQLite();

		const transaction = db.transaction(() => {
			const domainMap = new Map<string, string[]>();

			const domains = db.prepare<unknown[], { domain: string; }>(/* sql */`
			SELECT DISTINCT
				data ->> '$.domain' as domain
			FROM
				modules
			WHERE
				data ->> '$.tenant' = 'core';
			`).all().map(r => r.domain);

			for (const domain of domains) {
				const subdomains = db.prepare<unknown[], { subdomain: string; }>(/* sql */`
				SELECT DISTINCT
					data ->> '$.subdomain' as subdomain
				FROM
					modules
				WHERE 1 = 1
					AND data ->> '$.tenant' = 'core'
					AND data ->> '$.domain' = (?)
				`).all(domain).map(r => r.subdomain);

				domainMap.set(domain, subdomains);
			}

			return domainMap;
		});

		const result = [ ...transaction() ];
		this.response.send(result);
	}

}


@method.get('/api/code/module')
class GetModulesInSubdomain extends Endpoint {

	protected override handle(): any | Promise<any> {
		const { domain, subdomain, path } = this.request.query as {
			domain:    string;
			subdomain: string;
			path?:     string;
		};

		if (path) {
			const module = getModule(domain, subdomain, path);
			if (!module)
				return this.response.sendStatus(404);

			return this.response.send(module);
		}

		const modules = getAllModulesInSubdomain(domain, subdomain);
		if (!modules.length)
			return this.response.sendStatus(404);

		this.response.send(modules);
	}

}


@method.post('/api/code/module/new')
class insertModuleInSubdomain extends Endpoint {

	protected override handle(): any | Promise<any> {
		using db = new SQLite();

		const { tenant = 'core', domain, subdomain, path } = this.request.query as {
			tenant:    string;
			domain:    string;
			subdomain: string;
			path:      string;
		};

		const data = {
			tenant,
			type:       'library',
			domain,
			subdomain,
			path,
			content:    this.request.body.data,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		db.prepare<[string], { data: string }>(/* sql */`
		INSERT INTO modules (data) VALUES(json(?));
		`).run(JSON.stringify(data));

		this.response.sendStatus(200);

		const cacheSlug = createCacheSlug(data);
		tsCache.delete(cacheSlug);
	}

}


@method.patch('/api/code/module/update')
class UpdateModuleInSubdomain extends Endpoint {

	protected override handle(): any | Promise<any> {
		using db = new SQLite();

		const { tenant = 'core', domain, subdomain, path } = this.request.query as {
			tenant:    string;
			domain:    string;
			subdomain: string;
			path:      string;
		};

		const existing = db.prepare<
			[string, string, string, string],
			{ data: string }
		>(/* sql */`
		SELECT
			data
		FROM
			modules
		WHERE 1 = 1
			AND data ->> '$.tenant'    = (?)
			AND data ->> '$.domain'    = (?)
			AND data ->> '$.subdomain' = (?)
			AND data ->> '$.path'      = (?)
		LIMIT
			1;
		`).get(tenant, domain, subdomain, path);

		if (!existing?.data)
			return this.response.sendStatus(404);

		const existingObj = JSON.parse(existing?.data) as CodeModule;

		existingObj.content = this.request.body.data;
		existingObj.updated_at = new Date().toISOString();

		db.prepare(/* sql */`
		UPDATE
			modules
		SET
			data = json(?)
		WHERE 1 = 1
			AND data ->> '$.tenant'    = (?)
			AND data ->> '$.domain'    = (?)
			AND data ->> '$.subdomain' = (?)
			AND data ->> '$.path'      = (?)
		LIMIT
			1;
		`).run(JSON.stringify(existingObj), tenant, domain, subdomain, path);

		//console.log('update:', existingObj);

		this.response.sendStatus(200);

		const cacheSlug = createCacheSlug(existingObj);
		tsCache.delete(cacheSlug);
	}

}


@method.delete('/api/code/module/delete')
class DeleteModuleInSubdomain extends Endpoint {

	protected override handle(): any | Promise<any> {
		using db = new SQLite();

		const { tenant = 'core', domain, subdomain, path } = this.request.query as {
			tenant:    string;
			domain:    string;
			subdomain: string;
			path:      string;
		};

		db.prepare(/* sql */`
		DELETE FROM
			modules
		WHERE 1 = 1
			AND data ->> '$.tenant'    = (?)
			AND data ->> '$.domain'    = (?)
			AND data ->> '$.subdomain' = (?)
			AND data ->> '$.path'      = (?)
		LIMIT
			1;
		`).run(tenant, domain, subdomain, path);

		this.response.sendStatus(200);

		const cacheSlug = createCacheSlug({ tenant, domain, subdomain, path });
		tsCache.delete(cacheSlug);
	}

}


@method.get('/api/code/initialize')
class CreateDemoData extends Endpoint {

	protected override handle(): any | Promise<any> {
		using db = new SQLite();

		db.prepare(/* sql */`
		CREATE TABLE IF NOT EXISTS modules (
			id INTEGER PRIMARY KEY,
			data JSON
		);
		`).run();

		//db.prepare(/* sql */`
		//DELETE FROM modules
		//`).run();

		//const insert = db.prepare<[string]>(/* sql */`
		//INSERT INTO modules (data) VALUES(json(?));
		//`);

		//insert.run(JSON.stringify({
		//	tenant:     'core',
		//	type:       'library',
		//	domain:     'std',
		//	subdomain:  'site',
		//	path:       'redirect-config.json',
		//	content:    '{"/": "domain1/subdomain1/index.html"}',
		//	created_at: new Date().toISOString(),
		//	updated_at: new Date().toISOString(),
		//}));
		//insert.run(JSON.stringify({
		//	tenant:    'core',
		//	type:      'site',
		//	domain:    'domain1',
		//	subdomain: 'subdomain1',
		//	path:      'index.html',
		//	content:   `<!DOCTYPE html>
		//	<html lang="en">
		//	<head>
		//		<meta charset="UTF-8">
		//		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		//		<title>Document</title>
		//		<style>
		//			body {
		//				background-color: grey;
		//			}
		//		</style>
		//		<script type="module">
		//			import { hello, world } from '@/domain1/subdomain1/test1.ts'
		//			hello();
		//			world();
		//		</script>
		//	</head>
		//	<body>
		//	<div>
		//		Hello there, this is pretty cool that it works...
		//	</div>
		//	</body>
		//	</html>`,
		//	created_at: new Date().toISOString(),
		//	updated_at: new Date().toISOString(),
		//}));
		//insert.run(JSON.stringify({
		//	tenant:     'core',
		//	type:       'library',
		//	domain:     'domain1',
		//	subdomain:  'subdomain1',
		//	path:       'test1.ts',
		//	content:    "//domain1,subdomain1\nexport const hello = () => console.log('hello');",
		//	created_at: new Date().toISOString(),
		//	updated_at: new Date().toISOString(),
		//}));
		//insert.run(JSON.stringify({
		//	tenant:     'core',
		//	type:       'library',
		//	domain:     'domain1',
		//	subdomain:  'subdomain2',
		//	path:       'test2.ts',
		//	content:    "//domain1,subdomain2\nexport const world = () => console.log('world');",
		//	created_at: new Date().toISOString(),
		//	updated_at: new Date().toISOString(),
		//}));
		//insert.run(JSON.stringify({
		//	tenant:     'core',
		//	type:       'library',
		//	domain:     'domain2',
		//	subdomain:  'subdomain1',
		//	path:       'test1.ts',
		//	content:    "//domain2,subdomain1\nexport const hello = () => console.log('hello');",
		//	created_at: new Date().toISOString(),
		//	updated_at: new Date().toISOString(),
		//}));
		//insert.run(JSON.stringify({
		//	tenant:     'core',
		//	type:       'library',
		//	domain:     'domain2',
		//	subdomain:  'subdomain2',
		//	path:       'test2.ts',
		//	content:    "//domain2,subdomain2\nexport const world = () => console.log('world');",
		//	created_at: new Date().toISOString(),
		//	updated_at: new Date().toISOString(),
		//}));

		this.response.sendStatus(200);
	}

}


export default [
	GetAllPaths,
	GetAllDomains,
	GetSubdomains,
	GetAllDomainsAndSubdomains,
	GetModulesInSubdomain,
	insertModuleInSubdomain,
	UpdateModuleInSubdomain,
	DeleteModuleInSubdomain,
	CreateDemoData,
];
