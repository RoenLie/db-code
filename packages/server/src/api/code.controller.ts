import type { ExpressController } from '@roenlie/ferrite-server/app/file-routes.ts';
import { SQLite } from '../app/database.ts';
import { Endpoint } from '../app/endpoint.ts';


class GetAllPaths extends Endpoint {

	protected override configure(): void {
		this.get('/api/code/all');
	}

	protected override handle(): void | Promise<void> {
		using db = new SQLite();

		const files = db.prepare<unknown[], { data: string; }>(`
		SELECT
			data
		FROM
			modules;
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

		const files = db.prepare<unknown[], { domain: string; }>(`
		SELECT DISTINCT
			data ->> '$.domain' as domain
		FROM
			modules;
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

		const files = db.prepare<unknown[], { subdomain: string; }>(`
		SELECT DISTINCT
			data ->> '$.subdomain' as subdomain
		FROM
			modules
		WHERE
			data ->> '$.domain' = (?);
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

			const domains = db.prepare<unknown[], { domain: string; }>(`
			SELECT DISTINCT
				data ->> '$.domain' as domain
			FROM
				modules;
			`).all().map(r => r.domain);

			for (const domain of domains) {
				const subdomains = db.prepare<unknown[], { subdomain: string; }>(`
				SELECT DISTINCT
					data ->> '$.subdomain' as subdomain
				FROM
					modules
				WHERE
					data ->> '$.domain' = (?)
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
		const { domain, subdomain, path } = this.request.query as {
			domain:    string;
			subdomain: string;
			path?:     string;
		};

		using db = new SQLite();

		if (path) {
			const module = db.prepare<[string, string, string], { data: string; }>(`
			SELECT
				data
			FROM
				modules
			WHERE 1 = 1
				AND data ->> '$.domain' = (?)
				AND data ->> '$.subdomain' = (?)
				AND data ->> '$.path' = (?);
			`).get(domain, subdomain, path);

			if (!module)
				this.response.sendStatus(404);
			else
				this.response.send(JSON.parse(module?.data ?? '{}'));
		}
		else {
			const modules = db.prepare<[string, string], { data: string; }>(`
				SELECT
					data
				FROM
					modules
				WHERE 1 = 1
					AND data ->> '$.domain' = (?)
					AND data ->> '$.subdomain' = (?);
				`).all(domain, subdomain).map(r => JSON.parse(r.data));

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

		const { domain, subdomain, path } = this.request.query as {
			domain:    string;
			subdomain: string;
			path:      string;
		};

		const module = db.prepare<[string, string, string], { data: string }>(`
		SELECT
			data
		FROM
			modules
		WHERE 1 = 1
			AND data ->> '$.domain'    = (?)
			AND data ->> '$.subdomain' = (?)
			AND data ->> '$.path'      = (?)
		`).get(domain, subdomain, path);

		this.response.send(JSON.parse(module!.data));
	}

}


class AddModuleInSubdomain extends Endpoint {

	protected override configure(): void {
		this.post('/api/code/module/new');
	}

	protected override handle(): void | Promise<void> {
		using db = new SQLite();

		const { domain, subdomain, path } = this.request.query as {
			domain:    string;
			subdomain: string;
			path:      string;
		};

		const data = {
			domain,
			subdomain,
			path,
			content: this.request.body.data,
		};

		console.log('new:', data);

		//db.prepare<[string], { data: string }>(`
		//INSERT INTO modules (data) VALUES(json(?));
		//`).run(JSON.stringify({
		//	domain,
		//	subdomain,
		//	path,
		//	content: this.request.body,
		//}));

		this.response.sendStatus(200);
	}

}


class UpdateModuleInSubdomain extends Endpoint {

	protected override configure(): void {
		this.patch('/api/code/module/update');
	}

	protected override handle(): void | Promise<void> {
		using db = new SQLite();

		const { domain, subdomain, path } = this.request.query as {
			domain:    string;
			subdomain: string;
			path:      string;
		};

		const data = {
			domain,
			subdomain,
			path,
			content: this.request.body.data,
		};

		console.log('update:', data);
	}

}


class DeleteModuleInSubdomain extends Endpoint {

	protected override configure(): void {
		this.delete('/api/code/module/delete');
	}

	protected override handle(): void | Promise<void> {
		using db = new SQLite();

		const { domain, subdomain, path } = this.request.query as {
			domain:    string;
			subdomain: string;
			path:      string;
		};

		const data = {
			domain,
			subdomain,
			path,
		};

		console.log('delete:', data);
	}

}


class CreateDemoData extends Endpoint {

	protected override configure(): void {
		this.get('/api/code/initialize');
	}

	protected override handle(): void | Promise<void> {
		using db = new SQLite();

		db.prepare(`
		CREATE TABLE IF NOT EXISTS modules (
			id INTEGER PRIMARY KEY,
			data JSON
		);
		`).run();

		db.prepare(`
		DELETE FROM modules
		`).run();

		const insert = db.prepare(`
		INSERT INTO modules (data) VALUES(json(?));
		`);

		insert.run(JSON.stringify({
			domain:    'domain1',
			subdomain: 'subdomain1',
			path:      'test1.ts',
			content:   "//domain1,subdomain1\nexport const hello = () => console.log('hello');",
		}));
		insert.run(JSON.stringify({
			domain:    'domain1',
			subdomain: 'subdomain2',
			path:      'test2.ts',
			content:   "//domain1,subdomain2\nexport const world = () => console.log('world');",
		}));

		insert.run(JSON.stringify({
			domain:    'domain2',
			subdomain: 'subdomain1',
			path:      'test1.ts',
			content:   "//domain2,subdomain1\nexport const hello = () => console.log('hello');",
		}));
		insert.run(JSON.stringify({
			domain:    'domain2',
			subdomain: 'subdomain2',
			path:      'test2.ts',
			content:   "//domain2,subdomain2\nexport const world = () => console.log('world');",
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
	AddModuleInSubdomain,
	UpdateModuleInSubdomain,
	DeleteModuleInSubdomain,
	CreateDemoData,
] as ExpressController;
