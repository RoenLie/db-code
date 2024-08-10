import type { ControllerMethod, ExpressController } from '@roenlie/ferrite-server/app/file-routes.ts';
import { SQLite } from '../app/database.ts';
import { Endpoint, type EndpointRequest, type EndpointResponse } from '../app/endpoint.ts';


const test: ControllerMethod = {
	path:     '/api/code/test',
	method:   'get',
	handlers: [
		(_req, res) => {
			using db = new SQLite();

			const files = db.prepare(`
			SELECT * FROM modules;
			`).all();

			const content1 = db.prepare(`
			SELECT
				data ->> '$.contents' as contents
			FROM
				modules
			WHERE
				data ->> '$.name' = 'test1.ts';
			`).get();

			const content2 = db.prepare(`
			SELECT
				data ->> '$.name' as name,
				data ->> '$.contents' as contents
			FROM
				modules
			WHERE
				data ->> '$.name' = 'test2.ts';
			`).get();

			res.send({
				all: files,
				content1,
				content2,
			});
		},
	],
};


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
	test,
	GetAllPaths,
	GetAllDomains,
	GetSubdomains,
	GetModulesInSubdomain,
	GetCodeModule,
	CreateDemoData,
] as ExpressController;
