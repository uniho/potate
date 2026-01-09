// core/processTextFiber.ts

import { markPendingEffect } from './fiber';
import { EFFECT_TYPE_OTHER } from './configs';

import type { Fiber } from './flow.types';

export function processTextFiber(fiber: Fiber): void {
  const { node, alternate, isReactCompat } = fiber;
  const oldNode = alternate && alternate.node;

  // if text is different then only we should add it as an effect
  if (!isReactCompat || node !== oldNode) {
    // mark that the fiber has uncommitted effects
    markPendingEffect(fiber, EFFECT_TYPE_OTHER);
  }
}
