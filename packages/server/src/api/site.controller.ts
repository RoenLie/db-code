import { readFile } from 'fs/promises';
import { Endpoint } from '../app/endpoint.ts';

class GetAllPaths extends Endpoint {

	protected override configure(): void {
		this.get('/site');
	}

	protected override async handle(): Promise<void> {
		let file = await readFile('src/site/index.html', 'utf-8');
		file = file.replace(
			'<head>', str => str + '\n\t'
			+ '<script type="importmap">'
			+ '{"imports":{"@/":"./api/modules/"}}'
			+ '</script>',
		);

		this.response.send(file);
	}

}


export default [ GetAllPaths ];
