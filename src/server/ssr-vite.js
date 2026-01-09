// server/ssr-vite.js

import { renderToString } from './renderToString';

/**
 * Vite Plugin Export
 */
export function potateVitePlugin(options) {
  return {
    name: 'potate-ssr-plugin',
    transformIndexHtml(html) {
      const appHtml = renderToString(options.entryComponent);
      return html.replace('', appHtml);
    },
  };
}