// server/astro-client.js

import { createElement, createRoot } from 'potatejs';

export default (element) => {
  return (Component, props, slots, { client }) => {
    // Clear SSR content (Hydration mismatch workaround)
    element.innerHTML = '';

    const root = createRoot(element);
    root.render(createElement(Component, props));
  }
}
