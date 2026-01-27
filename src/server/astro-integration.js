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
              // By specifying the regex /.*/, all libraries within node_modules 
              // are forced to be bundled by Vite (noExternal).
              // This ensures that any 'react' imports within third-party libraries 
              // are correctly redirected to 'potatejs' via the defined alias.
              noExternal: [/.*/],
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