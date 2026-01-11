// core/Component.ts

import reRender from './reRender';
import { guardedSetState } from './updateUtils';
import { BRAHMOS_DATA_KEY } from './configs';

import type {
  ComponentInstance,
  PureComponentInstance,
  NewState,
  StateCallback,
  ObjectLiteral,
} from './flow.types';

export function Component(this: ComponentInstance, props: ObjectLiteral) {
  this.props = props;

  this.state = undefined;
  this.context = undefined;

  this[BRAHMOS_DATA_KEY] = {
    lastSnapshot: null,
    pendingSyncUpdates: [],
    pendingDeferredUpdates: [],
    fiber: null,
    nodes: null,
    mounted: false,
    committedValues: {},
    memoizedValues: null,
    isDirty: false,
    renderCount: 0,
  };
}

Component.prototype.setState = function(newState: NewState, callback: StateCallback) {
  const shouldRerender = guardedSetState(this, (transitionId) => ({
    state: newState,
    transitionId,
    callback,
  }));

  if (shouldRerender) reRender(this);
};

Component.prototype.forceUpdate = function(callback: StateCallback) {
  const brahmosData = this[BRAHMOS_DATA_KEY];

  // if there is no fiber (when component is not mounted) we don't need to do anything
  const { fiber } = brahmosData;
  if (!fiber) return;

  // keep the track of component through which force update is started
  fiber.root.forcedUpdateWith = this;

  this[BRAHMOS_DATA_KEY].isDirty = true;
  reRender(this);
  if (callback) callback(this.state);
};

Component.prototype.render = function() {};

Component.prototype.__render = function() {
  // get the new rendered node
  const nodes = this.render();

  // store the current reference of nodes so we can use this this on next render cycle
  this[BRAHMOS_DATA_KEY].nodes = nodes;
  return nodes;
};

Component.prototype.isReactComponent = true;

export function PureComponent(this: PureComponentInstance, props: ObjectLiteral) {
  Component.call(this, props);
}

PureComponent.prototype = Object.create(Component.prototype);
PureComponent.prototype.constructor = PureComponent;
PureComponent.prototype.isPureReactComponent = true;
