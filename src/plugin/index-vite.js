// plugin/index-vite.js

import { transformCode } from './transformer.js';

export default function teli() {
  return {
    name: 'potate',
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