import { useReflectMetadata } from '@roenlie/reflect-metadata';
import { injectable as _injectable, inject as _inject } from 'inversify';

export const injectable = (() => {
	useReflectMetadata();

	return _injectable;
})();


export const inject = (() => {
	useReflectMetadata();

	return _inject;
})();
