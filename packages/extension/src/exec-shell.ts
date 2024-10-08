import { exec, type ExecException } from 'child_process';


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

	const promise = new Promise<{ stdout: string, stderr: string }>((resolve, _reject) => {
		let timeout: NodeJS.Timeout;

		const debounce = (_error: ExecException | null, stdout: string, stderr: string) => {
			clearTimeout(timeout);

			timeout = setTimeout(() => {
				resolve({ stdout, stderr });
			}, 100);
		};

		exec(aggregator, debounce);
	});

	const { stdout, stderr } = await promise;
	if (stdout)
		return [ stdout, undefined ];
	else
		return [ undefined, stderr ];
};
