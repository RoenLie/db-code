import type { Request, RequestHandler, Response } from 'express';


export type EndpointHandler<TRequestModel = any, TResponseModel = any> = (
	req: Request<Record<string, string>, TResponseModel, TRequestModel, any, Record<string, any>>,
	res: Response<TResponseModel, Record<string, any>>
) => void | Promise<void>;


export type EndpointRequest<TRequestModel = any, TResponseModel = any> =
	Request<Record<string, string>, TResponseModel, TRequestModel, any, Record<string, any>>;


export type EndpointResponse<TResponseModel = any> = Response<TResponseModel, Record<string, any>>;


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
	#method?:  'get' | 'post' | 'put' | 'delete' | 'patch';
	#handlers: RequestHandler[] = [];

	protected request:  EndpointRequest<TRequestModel, TResponseModel>;
	protected response: EndpointResponse<TResponseModel>;

	protected abstract configure(): void;
	protected abstract handle(): void | Promise<void>;

	protected post(path: string) {
		this.#path = path;
		this.#method = 'post';
	}

	protected get(path: string) {
		this.#path = path;
		this.#method = 'get';
	}

	protected middleware(handler: EndpointHandler) {
		this.#handlers.push(handler);
	}

}
