import { SQLite } from '../app/database.ts';
import { Endpoint } from '../app/endpoint.ts';
import type { CodeModule } from './code.controller.ts';
import { createCacheSlug, handleTypescript } from './transpile-ts.ts';


class GetModule extends Endpoint {

	protected override configure(): void {
		this.get('/api/modules/*');
	}

	protected override async handle(): Promise<any> {
		const parts     = this.request.params['0']!.split('/');
		const domain    = parts[0]!;
		const subdomain = parts[1]!;
		const path      = parts.slice(2).join('/');

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
			return this.response.sendStatus(404);

		const data = JSON.parse(module.data) as CodeModule;

		const cacheSlug = createCacheSlug(data);
		const transpiled = await handleTypescript(cacheSlug, data.content);

		console.log(transpiled);

		this.response.header('Content-Type', 'text/javascript;charset=UTF-8');
		this.response.send(transpiled);
	}

}


export default [ GetModule ];
