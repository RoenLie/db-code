import { mapEndpoints, registerEndpoints } from './app/endpoint-mapper.js';
import { server } from './app/main.js';


await mapEndpoints('src/api/**.controller.ts');
await registerEndpoints();


const serverUrl = new URL(process.env.URL);
server.listen(Number(serverUrl.port), serverUrl.hostname, () => {
	console.log(`⚡️[server]: Server is running at ${ process.env.URL }`);
});
