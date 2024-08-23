import { Endpoint } from '../app/endpoint.ts';
import { getModule, moduleImportToParts } from './module-service.ts';
import { createCacheSlug, handleTypescript } from './transpile-ts.ts';


class GetModule extends Endpoint {

	protected override configure(): void {
		this.get('/api/modules/*');
	}

	protected override async handle(): Promise<any> {
		const url = this.request.params['0'];
		if (!url)
			return this.response.sendStatus(404);

		const { domain, subdomain, path } = moduleImportToParts(url);

		const module = getModule(domain, subdomain, path);
		if (!module)
			return this.response.sendStatus(404);

		const cacheSlug = createCacheSlug(module);
		const transpiled = await handleTypescript(cacheSlug, module.content);

		this.response.header('Content-Type', 'text/javascript;charset=UTF-8');
		this.response.send(transpiled);
	}

}


export default [ GetModule ];
