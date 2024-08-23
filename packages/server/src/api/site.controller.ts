import { Endpoint } from '../app/endpoint.ts';
import { getModule, moduleImportToParts } from './module-service.ts';


class SiteRedirect extends Endpoint {

	protected override configure(): void {
		this.get('/*');
	}

	protected routes: Record<string, string> = {
		'/': 'domain1/subdomain1/index.html',
	};

	protected override async handle(): Promise<any> {
		const route = this.routes[this.request.url];
		if (route) {
			const { domain, subdomain, path } = moduleImportToParts(route);
			const module = getModule(domain, subdomain, path);
			if (!module)
				return;

			const content = module.content.replace(
				'<head>', str => str + '\n\t'
				+ '<script type="importmap">'
				+ '{"imports":{"@/":"./api/modules/"}}'
				+ '</script>',
			);

			return this.response.send(content);
		}
	}

}


export default [ SiteRedirect ];
