import type { ExpressController } from '@roenlie/ferrite-server/app/file-routes.ts';
import { SQLite } from '../app/database.ts';
import { Endpoint } from '../app/endpoint.ts';
import { createCacheSlug, tsCache } from './transpile-ts.ts';


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


class GetAllPaths extends Endpoint {

	protected override configure(): void {
		this.get('/api/code/all');
	}

	protected override handle(): void | Promise<void> {
		using db = new SQLite();

		const files = db.prepare<unknown[], { data: string; }>(/* sql */`
		SELECT data
		FROM modules;
		`).all().map(r => JSON.parse(r.data));

		this.response.send(files);
	}

}


class GetAllDomains extends Endpoint {

	protected override configure(): void {
		this.get('/api/code/domain');
	}

	protected override handle(): void | Promise<void> {
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


class GetSubdomains extends Endpoint {

	protected override configure(): void {
		this.get('/api/code/subdomain');
	}

	protected override handle(): void | Promise<void> {
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

class GetAllDomainsAndSubdomains extends Endpoint {

	protected override configure(): void {
		this.get('/api/code/domains-and-subdomains');
	}

	protected override handle(): void | Promise<void> {
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


		this.response.send([ ...transaction() ]);
	}

}


class GetModulesInSubdomain extends Endpoint {

	protected override configure(): void {
		this.get('/api/code/module');
	}

	protected override handle(): void | Promise<void> {
		const { tenant = 'core', domain, subdomain, path } = this.request.query as {
			tenant:    string;
			domain:    string;
			subdomain: string;
			path?:     string;
		};

		using db = new SQLite();

		if (path) {
			const module = db.prepare<
				[string, string, string, string],
				{ data: string; }
			>(/* sql */`
			SELECT
				data
			FROM
				modules
			WHERE 1 = 1
				AND data ->> '$.tenant'    = (?)
				AND data ->> '$.domain'    = (?)
				AND data ->> '$.subdomain' = (?)
				AND data ->> '$.path'      = (?);
			`).get(tenant, domain, subdomain, path);

			if (!module)
				this.response.sendStatus(404);
			else
				this.response.send(JSON.parse(module?.data ?? '{}'));
		}
		else {
			const modules = db.prepare<[string, string, string], { data: string; }>(/* sql */`
			SELECT
				data
			FROM
				modules
			WHERE 1 = 1
				AND data ->> '$.tenant'    = (?)
				AND data ->> '$.domain'    = (?)
				AND data ->> '$.subdomain' = (?);
			`).all(tenant, domain, subdomain).map(r => JSON.parse(r.data));

			this.response.send(modules);
		}
	}

}


class GetCodeModule extends Endpoint {

	protected override configure(): void {
		this.get('/api/code/content');
	}

	protected override handle(): void | Promise<void> {
		using db = new SQLite();

		const { tenant = 'core', domain, subdomain, path } = this.request.query as {
			tenant:    string;
			domain:    string;
			subdomain: string;
			path:      string;
		};

		const module = db.prepare<[string, string, string], { data: string }>(/* sql */`
		SELECT
			data
		FROM
			modules
		WHERE 1 = 1
			AND data ->> '$.tenant'    = (?)
			AND data ->> '$.domain'    = (?)
			AND data ->> '$.subdomain' = (?)
			AND data ->> '$.path'      = (?)
		`).get(domain, subdomain, path);

		this.response.send(JSON.parse(module!.data));
	}

}


class insertModuleInSubdomain extends Endpoint {

	protected override configure(): void {
		this.post('/api/code/module/new');
	}

	protected override handle(): void | Promise<void> {
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


class UpdateModuleInSubdomain extends Endpoint {

	protected override configure(): void {
		this.patch('/api/code/module/update');
	}

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

		console.log('update:', existingObj);

		this.response.sendStatus(200);

		const cacheSlug = createCacheSlug(existingObj);
		tsCache.delete(cacheSlug);
	}

}


class DeleteModuleInSubdomain extends Endpoint {

	protected override configure(): void {
		this.delete('/api/code/module/delete');
	}

	protected override handle(): void | Promise<void> {
		using db = new SQLite();

		const { tenant = 'core', domain, subdomain, path } = this.request.query as {
			tenant:    string;
			domain:    string;
			subdomain: string;
			path:      string;
		};

		const data = {
			domain,
			subdomain,
			path,
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

		console.log('delete:', data);

		this.response.sendStatus(200);

		const cacheSlug = createCacheSlug({ tenant, domain, subdomain, path });
		tsCache.delete(cacheSlug);
	}

}


class CreateDemoData extends Endpoint {

	protected override configure(): void {
		this.get('/api/code/initialize');
	}

	protected override handle(): void | Promise<void> {
		using db = new SQLite();

		db.prepare(/* sql */`
		CREATE TABLE IF NOT EXISTS modules (
			id INTEGER PRIMARY KEY,
			data JSON
		);
		`).run();

		db.prepare(/* sql */`
		DELETE FROM modules
		`).run();

		const insert = db.prepare<[string]>(/* sql */`
		INSERT INTO modules (data) VALUES(json(?));
		`);

		insert.run(JSON.stringify({
			tenant:     'core',
			type:       'library',
			domain:     'domain1',
			subdomain:  'subdomain1',
			path:       'test1.ts',
			content:    "//domain1,subdomain1\nexport const hello = () => console.log('hello');",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		}));
		insert.run(JSON.stringify({
			tenant:     'core',
			type:       'library',
			domain:     'domain1',
			subdomain:  'subdomain2',
			path:       'test2.ts',
			content:    "//domain1,subdomain2\nexport const world = () => console.log('world');",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		}));
		insert.run(JSON.stringify({
			tenant:     'core',
			type:       'library',
			domain:     'domain2',
			subdomain:  'subdomain1',
			path:       'test1.ts',
			content:    "//domain2,subdomain1\nexport const hello = () => console.log('hello');",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		}));
		insert.run(JSON.stringify({
			tenant:     'core',
			type:       'library',
			domain:     'domain2',
			subdomain:  'subdomain2',
			path:       'test2.ts',
			content:    "//domain2,subdomain2\nexport const world = () => console.log('world');",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		}));

		this.response.sendStatus(200);
	}

}


export default [
	GetAllPaths,
	GetAllDomains,
	GetSubdomains,
	GetAllDomainsAndSubdomains,
	GetModulesInSubdomain,
	GetCodeModule,
	insertModuleInSubdomain,
	UpdateModuleInSubdomain,
	DeleteModuleInSubdomain,
	CreateDemoData,
] as ExpressController;
