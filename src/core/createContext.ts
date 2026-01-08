// core/createContext.ts

import { Component } from './circularDep';
import { BRAHMOS_DATA_KEY } from './configs';
import { setUpdateTime, getFiberFromComponent } from './fiber';

import type { Fiber, AnyComponentInstance, ContextType } from './flow.types';

type ConsumerCallbackReturn = (value: any) => void;

let ctxId = 1;
export function getConsumerCallback(component: AnyComponentInstance): ConsumerCallbackReturn {
  return function (value: any): void {
    /**
     * just set the correct update time on subscribed component,
     * and then workloop will take care of updating them.
     */
    const fiber: Fiber = getFiberFromComponent(component);
    const { updateType } = fiber.root;

    // update time only when context value has been changed
    if (component.context !== value) {
      // mark consumer dirty
      component[BRAHMOS_DATA_KEY].isDirty = true;

      setUpdateTime(fiber, updateType);
    }
  };
}

export default function createContext(defaultValue: any): ContextType {
  const id = `cC${ctxId++}`;

  class Provider extends Component {
    constructor(props) {
      super(props);
      this.subs = [];
    }

    shouldComponentUpdate(nextProp) {
      const { value } = this.props;
      if (value !== nextProp.value) {
        this.subs.forEach((cb) => cb(nextProp.value));
      }
      return true;
    }

    sub(component) {
      const { subs } = this;
      const callback = getConsumerCallback(component);

      subs.push(callback);

      const { componentWillUnmount } = component;

      component.componentWillUnmount = () => {
        subs.splice(subs.indexOf(callback), 1);
        if (componentWillUnmount) componentWillUnmount();
      };
    }

    render() {
      return this.props.children;
    }
  }

  // add metadata for provider
  Provider.__ccId = id;

  /**
   * consumer component which subscribes to provider on initialization
   * and unsubscribe on component unmount
   */
  class Consumer extends Component {
    render() {
      return this.props.children(this.context);
    }
  }

  // Attach properties to Provider to make it act as the Context object
  Provider.id = id;
  Provider.defaultValue = defaultValue;
  Provider.Provider = Provider;
  Provider.Consumer = Consumer;

  // add contextType information on Consumer
  Consumer.contextType = Provider;

  return Provider;
}
