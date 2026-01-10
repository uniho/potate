// server/astro-integration.js

import potateVite from '../plugin/index-vite'

export default function potate() {
  return {
    name: 'potate',
    hooks: {
      'astro:config:setup': ({ addRenderer, updateConfig }) => {
        addRenderer({
          name: 'potate',
          serverEntrypoint: 'potatejs/astro/render',
          clientEntrypoint: 'potatejs/astro/client',
        });
        updateConfig({
          vite: {
            plugins: [potateVite()],
          },
        });
      },
    },
  };
}