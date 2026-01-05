// src/core/tearDown.ts
import { callLifeCycle, remove, getNextSibling, isMounted } from './utils';

import {
  isComponentNode,
  isRenderableNode,
  isTagNode,
  CLASS_COMPONENT_NODE,
  isPrimitiveNode,
} from './brahmosNode';

import { setRef } from './refs';

import { cleanEffects } from './hooks';

import type { HostFiber } from './flow.types';

function tearDownChild(child, part, _isTagNode, removeDOM) {
  let _removeDOM = child.part.parentNode !== part.parentNode && _isTagNode ? false : removeDOM;

  const { node } = child;
  if (node && node.portalContainer) {
    _removeDOM = true;
  }

  tearDownFiber(child, _removeDOM);
}

function tearDownFiber(fiber, removeDOM) {
  const { node, part, nodeInstance } = fiber;

  fiber.shouldTearDown = false;

  if (!isRenderableNode(node)) return;

  const _isTagNode = isTagNode(node);
  let { child } = fiber;

  if (child) {
    tearDownChild(child, part, _isTagNode, removeDOM);

    while (child.sibling) {
      child = child.sibling;
      tearDownChild(child, part, _isTagNode, removeDOM);
    }
  }

  if (isPrimitiveNode(node) && removeDOM) {
    const textNode = getNextSibling(part.parentNode, part.previousSibling);
    if (textNode) remove(textNode);
    return;
  }

  const { ref } = node;

  if (ref) {
    setRef(ref, null);
  }

  if (!nodeInstance) return;

  if (_isTagNode) {
    const { domNodes } = nodeInstance;
    if (removeDOM) remove(domNodes);
  }
  else if (isComponentNode(node) && isMounted(nodeInstance)) {

    // extended unmount logic.
    nodeInstance.__unmount.forEach(finalize => finalize());
    nodeInstance.__unmount.clear();

    if (node.nodeType === CLASS_COMPONENT_NODE) {
      callLifeCycle(nodeInstance, 'componentWillUnmount');
    } else {
      cleanEffects(fiber, true);
    }
  }
}

export default function(root: HostFiber): void {
  const { tearDownFibers } = root;

  tearDownFibers.forEach((fiber) => {
    if (fiber.shouldTearDown) tearDownFiber(fiber, true);
  });

  root.tearDownFibers = [];
}
