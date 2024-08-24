import type { Request, RequestHandler, Response } from 'express';
import type { ControllerMethod } from './endpoint-mapper.ts';


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
		this.configure?.();

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
	}

	#order = 0;
	#path?:    string;
	#method?:  RequestMethod;
	#handlers: RequestHandler[] = [];

	protected request:  EndpointRequest<TRequestModel, TResponseModel>;
	protected response: EndpointResponse<TResponseModel>;

	protected configure?(): any;
	protected abstract handle(): any | Promise<any>;

	public toHandler(): ControllerMethod {
		if (!this.#path)
			throw new TypeError('Missing path');
		if (!this.#method)
			throw new TypeError('Missing method');

		return {
			order:    this.#order,
			path:     this.#path,
			method:   this.#method,
			handlers: this.#handlers,
		};
	}

	protected get(path: string)    { this.#setPathAndMethod(path, 'get');	   }
	protected post(path: string)   { this.#setPathAndMethod(path, 'post');	}
	protected put(path: string)    { this.#setPathAndMethod(path, 'put');	   }
	protected patch(path: string)  { this.#setPathAndMethod(path, 'patch');	}
	protected delete(path: string) { this.#setPathAndMethod(path, 'delete');	}

	#setPathAndMethod(path: string, method: RequestMethod) {
		this.#path = path;
		this.#method = method;
	}

	protected middleware(handler: EndpointHandler) {
		this.#handlers.push(handler);
	}

}


export const method = {
	get: <T extends new (...args: any) => Endpoint>(path: string) => {
		// @ts-expect-error
		return (base: T): T => class extends base {

			protected override configure() {
				this.get(path);
			}

		};
	},
	post: <T extends new (...args: any) => Endpoint>(path: string) => {
		// @ts-expect-error
		return (base: T): T => class extends base {

			protected override configure() {
				this.post(path);
			}

		};
	},
	put: <T extends new (...args: any) => Endpoint>(path: string) => {
		// @ts-expect-error
		return (base: T): T => class extends base {

			protected override configure() {
				this.put(path);
			}

		};
	},
	patch: <T extends new (...args: any) => Endpoint>(path: string) => {
		// @ts-expect-error
		return (base: T): T => class extends base {

			protected override configure() {
				this.patch(path);
			}

		};
	},
	delete: <T extends new (...args: any) => Endpoint>(path: string) => {
		// @ts-expect-error
		return (base: T): T => class extends base {

			protected override configure() {
				this.delete(path);
			}

		};
	},
};
