// src/core/root.ts

import { createBrahmosNode } from './circularDep';
import { BrahmosRootComponent } from './utils';
import { createFiber, createHostFiber, setUpdateTime } from './fiber';
import { doDeferredProcessing } from './workLoop';
import { withUpdateSource } from './updateUtils';
import { 
  UPDATE_TYPE_DEFERRED, 
  UPDATE_SOURCE_TRANSITION, 
  ROOT_FIBER_KEY 
} from './configs';
import { PREDEFINED_TRANSITION_DEFERRED } from './transitionUtils';
import tearDown from './tearDown';
import type { ExtendedElement, HostFiber } from './flow.types';

/**
 * createRoot API
 * Provides React 19 style root management with Concurrent Rendering by default.
 */
export function createRoot(container: ExtendedElement) {
  /**
   * Check if a root already exists on the container.
   * If not, create a new HostFiber and associate it with the container.
   */
  let root: HostFiber = container[ROOT_FIBER_KEY];

  if (!root) {
    root = createHostFiber(container); 
    container[ROOT_FIBER_KEY] = root;
  }

  return {
    /**
     * render method
     * Renders the given node into the container using background processing.
     * This ensures the main thread remains responsive during initial mount.
     */
    render(node: any) {
      let fiber = root.current;

      if (!fiber) {
        /**
         * Initial render: Set up the root component and create the first Fiber.
         */
        const rootNode = createBrahmosNode(BrahmosRootComponent, { children: node });
        const part = {
          parentNode: container,
          previousSibling: null,
          isNode: true,
        };

        fiber = createFiber(root, rootNode, part); 
        fiber.parent = root;
        root.current = fiber;
      } else {
        /**
         * Update render: Update props of the root component and mark for deferred processing.
         */
        fiber.node.props.children = node;
        fiber.processedTime = 0;
        setUpdateTime(fiber, UPDATE_TYPE_DEFERRED);
      }

      /**
       * Switch to Concurrent Mode:
       * Instead of blocking the thread with doSyncProcessing, we use doDeferredProcessing.
       * We treat the initial render as a "Transition" to allow background processing.
       */
      const transition = PREDEFINED_TRANSITION_DEFERRED;
      if (!root.pendingTransitions.includes(transition)) {
        root.pendingTransitions.push(transition);
      }

      withUpdateSource(UPDATE_SOURCE_TRANSITION, () => {
        root.updateSource = UPDATE_SOURCE_TRANSITION;
        /**
         * Initiate background rendering. The workLoop will use requestIdleCallback 
         * or MessageChannel to process the tree in small chunks.
         */
        doDeferredProcessing(root); 
      });
    },

    /**
     * unmount method
     * Tears down the entire tree and releases all associated resources.
     */
    unmount() {
      // Cancel any tasks currently scheduled on the root.
      if (root.cancelSchedule) {
        root.cancelSchedule();
        root.cancelSchedule = null;
      }

      // Mark the current Fiber tree for teardown and execute.
      const currentFiber = root.current;
      if (currentFiber) {
        currentFiber.shouldTearDown = true;
        root.tearDownFibers.push(currentFiber);

        /**
         * The tearDown utility handles DOM removal, lifecycle execution,
         * and cleanup of all subscriptions (e.g., from the watch API).
         */
        tearDown(root); 
        
        // Clear the reference to the current tree.
        root.current = null;
      }

      // Remove the root reference from the container to prevent memory leaks.
      delete container[ROOT_FIBER_KEY];
    }
  };
}
