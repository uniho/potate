// server/astro-integration.js

import potateVite from '../plugin/index-vite-jsx'

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
            resolve: {
              alias: {
                'react': 'potatejs',
                'react-dom': 'potatejs',
                'react/jsx-runtime': 'potatejs',
              },
            },
            ssr: {
              external: ['@emotion/css', '@emotion/server']
            },
            optimizeDeps: {
              exclude: ['@emotion/css', '@emotion/server']
            }
          },
        });
      },
    },
  };
}