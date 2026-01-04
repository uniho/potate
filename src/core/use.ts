// src/core/use.ts
import { getCurrentComponentFiber } from './fiber';

/**
 * Subroutine: Handling Promise (Resource)
 */
export function handlePromise(promise: any): any {
  if (promise.status === 'fulfilled') return promise.value;
  if (promise.status === 'rejected') throw promise.reason;
  if (promise.status === 'pending') throw promise;

  // Initial execution: Inject state and suspend
  promise.status = 'pending';
  promise.then(
    (res: any) => {
      promise.status = 'fulfilled';
      promise.value = res;
    },
    (err: any) => {
      promise.status = 'rejected';
      promise.reason = err;
    }
  );
  throw promise;
}

/**
 * The use() API
 * Handles asynchronous resources (Suspense).
 */
export function use(usable: any): any {
  const fiber = getCurrentComponentFiber();
  if (!fiber) throw new Error('use() must be called during render.');

  // 1. Handle Thenables (Promises)
  if (usable && typeof usable.then === 'function') {
    return handlePromise(usable);
  }

  // Future extension: Handle Context, etc.
  // if (isContext(usable)) return handleContext(fiber, usable);

  throw new Error('Unsupported type passed to use()');
}