import type { Request, RequestHandler, Response } from 'express';


export type EndpointHandler<TRequestModel = any, TResponseModel = any> = (
	req: Request<Record<string, string>, TResponseModel, TRequestModel, any, Record<string, any>>,
	res: Response<TResponseModel, Record<string, any>>
) => void | Promise<void>;


export type EndpointRequest<TRequestModel = any, TResponseModel = any> =
	Request<Record<string, string>, TResponseModel, TRequestModel, any, Record<string, any>>;


export type EndpointResponse<TResponseModel = any> = Response<TResponseModel, Record<string, any>>;


export type RequestMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';


export abstract class Endpoint<TRequestModel = any, TResponseModel = any> {

	constructor() {
		this.configure();

		if (this.handle === undefined)
			throw new TypeError('Missing handle implementation');

		this.#handlers.push((req, res) => {
			this.request = req;
			this.response = res;
			this.handle();
		});

		if (this.#path === undefined)
			throw new TypeError('Missing path');
		if (this.#method === undefined)
			throw new TypeError('Missing method');

		return {
			path:     this.#path,
			method:   this.#method,
			handlers: this.#handlers,
		} as any;
	}

	#path?:    string;
	#method?:  RequestMethod;
	#handlers: RequestHandler[] = [];

	protected request:  EndpointRequest<TRequestModel, TResponseModel>;
	protected response: EndpointResponse<TResponseModel>;

	protected abstract configure(): void;
	protected abstract handle(): void | Promise<void>;

	protected get(path: string)    { this.setPathAndMethod(path, 'get');	   }
	protected post(path: string)   { this.setPathAndMethod(path, 'post');	}
	protected put(path: string)    { this.setPathAndMethod(path, 'put');	   }
	protected patch(path: string)  { this.setPathAndMethod(path, 'patch');	}
	protected delete(path: string) { this.setPathAndMethod(path, 'delete');	}

	protected setPathAndMethod(path: string, method: RequestMethod) {
		this.#path = path;
		this.#method = method;
	}

	protected middleware(handler: EndpointHandler) {
		this.#handlers.push(handler);
	}

}
