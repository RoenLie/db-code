import { registerControllers } from './app/file-routes.js';
import { server } from './app/main.js';


await registerControllers('src/api/**.controller.ts');

const url = new URL(process.env.URL);
server.listen(Number(url.port), url.hostname, () => {
	console.log(`⚡️[server]: Server is running at ${ process.env.URL }`);
});
