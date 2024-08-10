import envPaths, { type Paths } from 'env-paths';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path/posix';


interface AugmentedPaths extends Paths {
	code: string;
}


export const appName = 'DbCode';
export const paths = envPaths(appName) as AugmentedPaths;


// Posix works for windows, and other libs like globby rely on posix paths.
// Therefor we try to always use posix.
for (const key of Object.keys(paths))
	(paths as any)[key] = (paths as any)[key].replaceAll('\\', '/');

// Create the path to custom paths.
paths.code = join(paths.data, 'Code');

// Make sure the application paths exist.
Object.values(paths).map(path => mkdir(path, { recursive: true }));
