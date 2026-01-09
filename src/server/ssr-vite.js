// server/ssr-vite.js

import { renderToString } from './renderToString';

/**
 * Vite Plugin Export
 */
export default function(options = {}) {
  return {
    name: 'potate-ssr-plugin',
    async transformIndexHtml(html, { server }) {
      let entry = options.entry;
      if (!entry) {
        // Find the entry script from <script type="module" src="...">, independent of attribute order.
        const matches = html.matchAll(/<script([^>]+)>/g);
        for (const match of matches) {
          if (match[1].includes('type="module"')) {
            const srcMatch = match[1].match(/src="([^"]+)"/);
            if (srcMatch) {
              entry = srcMatch[1];
              break;
            }
          }
        }
      }

      let component = options.entryComponent;
      if (server && entry) {
        const module = await server.ssrLoadModule(entry);
        component = module.App || module.default;
      }

      // If the component is a function (e.g., a functional component), execute it to get the renderable node.
      if (typeof component === 'function') {
        component = component({});
      }

      const appHtml = renderToString(component);

      const target = options.replaceTarget || '<div id="app"></div>';
      if (target.includes('></')) {
        return html.replace(target, target.replace('></', `>${appHtml}</`));
      }
      return html.replace(target, appHtml);
    },
  };
}