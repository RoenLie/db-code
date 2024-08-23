import ts from 'typescript';
import { SQLite } from '../app/database.ts';
import { Endpoint } from '../app/endpoint.ts';
import type { CodeModule } from './code.controller.ts';

class GetModule extends Endpoint {

	protected override configure(): void {
		this.get('/api/modules/*');
	}

	protected override async handle(): Promise<any> {
		const parts = this.request.params['0']!.split('/');
		const domain = parts[0]!;
		const subdomain = parts[1]!;
		const path = parts.slice(2).join('/');

		console.log({ domain, subdomain, path });

		using db = new SQLite();

		const module = db.prepare<[string, string, string], { data: string }>(/* sql */`
		SELECT
			data
		FROM
			modules
		WHERE 1 = 1
			AND data ->> '$.domain'    = (?)
			AND data ->> '$.subdomain' = (?)
			AND data ->> '$.path'      = (?)
		LIMIT
			1;
		`).get(domain, subdomain, path);

		if (!module)
			return this.response.sendStatus(404);

		const data = JSON.parse(module.data) as CodeModule;

		const cacheSlug = createCacheSlug(data.tenant, data.domain, data.subdomain, data.path);
		const transpiled = await handleTypescript(cacheSlug, data.content);

		console.log(transpiled);

		this.response.header('Content-Type', 'text/javascript;charset=UTF-8');
		this.response.send(transpiled);
	}

}


export default [ GetModule ];


const tsCache = new Map<string, string>();
const createCacheSlug = (tenant: string, domain: string, subdomain: string, path: string) =>
	tenant + '_' + domain + '_' + subdomain + '_' + path;

const handleTypescript = async (path: string, content: string): Promise<string> => {
	if (!tsCache.has(path)) {
		const code = ts.transpile(content, {
			target:                  ts.ScriptTarget.ESNext,
			module:                  ts.ModuleKind.ESNext,
			moduleResolution:        ts.ModuleResolutionKind.Bundler,
			importHelpers:           false,
			experimentalDecorators:  true,
			emitDecoratorMetadata:   true,
			useDefineForClassFields: false,
		});

		tsCache.set(path, code);
	}

	return tsCache.get(path)!;
};
