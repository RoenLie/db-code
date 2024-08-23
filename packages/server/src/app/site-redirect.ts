import type { RequestListener } from 'node:http';


export const siteRedirect: RequestListener = (req, res) => {
	console.log(req.url);
};
