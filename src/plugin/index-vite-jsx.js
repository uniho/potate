// plugin/index-vite-jsx.js

import { transformCode } from './transformer.js';

export default function() {
  return {
    name: 'potatejs',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.(jsx|tsx)$/.test(id)) return null;
      return {
        code: transformCode(code),
        map: null,
      };
    },
  };
}