import type { RequestHandler, Express } from 'express';
import { glob } from 'node:fs/promises';

import { app } from './main.js';
import { basename, join, resolve } from 'path';
import { Endpoint } from './endpoint.js';


const registerCache = new Set<string>();
const patternCache = new Set<string>();


export interface ControllerMethod {
	order:    number;
	path:     string;
	method:   Extract<keyof Express, 'get' | 'put' | 'post' | 'patch' | 'delete'>;
	handlers: RequestHandler[];
}


export type ExpressController = (ControllerMethod | typeof Endpoint)[];


export const registerEndpoints = async (
	/** Glob pattern for finding the controllers you want to automatically register. */
	pattern: string,
) => {
	// We only register controllers from a directory subtree once.
	if (patternCache.has(pattern))
		return;

	patternCache.add(pattern);

	const filePaths: string[] = [];
	const pathGlob = glob(pattern);
	for await (const path of pathGlob)
		filePaths.push(path);

	const filesToRegister = filePaths
		.map(path => 'file:' + join(resolve(), path).replaceAll('\\', '/'))
		.filter(path => {
			const isController = basename(path).endsWith('controller.ts');
			if (isController && !registerCache.has(path))
				return !!registerCache.add(path);
		});

	const promises = filesToRegister
		.map(async path => await import(path).then(m => m.default));

	const imports: ExpressController[] = await Promise.all(promises);

	imports.forEach(methods => methods.forEach(m => {
		let method = m as ControllerMethod;

		if (isClass(m))
			method = (new m()).toHandler();

		app[method.method](method.path, method.handlers);
	}));
};


export const isClass = (obj: any): obj is new () => Endpoint => {
	if (typeof obj !== 'function')
		return false;

	const descriptor = Object.getOwnPropertyDescriptor(obj, 'prototype');
	if (!descriptor)
		return false;

	return !descriptor.writable;
};
