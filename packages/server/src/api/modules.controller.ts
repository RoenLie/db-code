import { Endpoint } from '../app/endpoint.ts';

class GetModule extends Endpoint {

	protected override configure(): void {
		this.get('/api/modules/*');
	}

	protected override handle(): void | Promise<void> {
		const path = this.request.params['0'];

		console.log(path);

		this.response.header('Content-Type', 'text/javascript;charset=UTF-8');
		this.response.send(`
		console.log('what am i');
		window.confirm('lol, script injected');
		`);
	}

}


export default [ GetModule ];
