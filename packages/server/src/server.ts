import { registerControllers } from './app/file-routes.js';
import { server } from './app/main.js';
//import { siteRedirect } from './app/site-redirect.js';


await registerControllers('src/api/**.controller.ts');


const serverUrl = new URL(process.env.URL);

//server.addListener('request', (req, res) => {
//	const url = new URL(`http://${ process.env['HOST'] ??
//		`localhost:${ serverUrl.port }` }${ req.url }`);

//	console.log(url);
//});

//server.addListener('request', siteRedirect);

server.listen(Number(serverUrl.port), serverUrl.hostname, () => {
	console.log(`⚡️[server]: Server is running at ${ process.env.URL }`);
});
