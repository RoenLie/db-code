import { exec as _exec } from 'child_process';
import { promisify } from 'node:util';

const exec = promisify(_exec);


export type Maybe<T, E> = readonly [data: T, error: undefined]
	| readonly [data: undefined, error: E];


export const $ = async (
	strings: TemplateStringsArray, ...values: unknown[]
): Promise<Maybe<string, string>> => {
	let aggregator = '';

	for (let i = 0; i < strings.length; i++) {
		const string = strings[i];
		aggregator += string;

		const expr = values[i];
		if (expr === undefined || expr === false)
			continue;

		let value: unknown = expr;

		if (typeof value === 'function')
			value = value();

		if (value instanceof Promise)
			value = await value;

		if (Array.isArray(value))
			value = (await Promise.all(value)).join('');

		aggregator += value;
	}

	const { stdout, stderr } = await exec(aggregator,
		{ cwd: import.meta.dirname });

	//console.log({ stdout, stderr });
	if (stdout)
		return [ stdout, undefined ];
	else
		return [ undefined, stderr ];
};
