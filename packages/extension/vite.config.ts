import { defineConfig, type UserConfig } from 'vite';


export default defineConfig(async () => {
	return {
		build: {
			outDir:      'dist',
			emptyOutDir: true,
			minify:      false,
			ssr:         true,
			lib:         {
				entry:    './src/extension.ts',
				formats:  [ 'cjs' ],
				fileName: () => 'extension.cjs',
			},
			rollupOptions: {
				external: [ 'vscode' ],
			},
		},
		ssr: {
			noExternal: true,
		},
	} as UserConfig;
});
