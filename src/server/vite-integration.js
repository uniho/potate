// server/vite-integration.js

import potateVite from '../plugin/index-vite-jsx';
import runtime from '../server/vite-runtime';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { ViteNodeServer } from 'vite-node/server';
import { ViteNodeRunner } from 'vite-node/client';
import { createServer } from 'vite';

const pageRoot = 'pages';
const initName = '_init';

export default function(options = {}) {

  let viteConfig
  let devServer
  let runner
  let localServer
  let runtimeRefId

  const RUNTIME_PUBLIC_ID = 'virtual:potate-runtime';
  const RUNTIME_INTERNAL_ID = '\0' + RUNTIME_PUBLIC_ID;

  const RUNNER_PUBLIC_ID = 'virtual:potate-runner';
  
  // Calculate path here to be available in load()
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const renderToStringPath = path.join(__dirname, 'renderToString.js').replace(/\\/g, '/');

  return {
    name: 'potate',
    enforce: 'pre',
    config() {
      return {
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
      };
    },

    configResolved(config) { viteConfig = config; },

    configureServer(server) { devServer = server; },

    buildStart() {
      if (viteConfig.command === 'build') {
        runtimeRefId = this.emitFile({
          type: 'chunk',
          id: RUNTIME_PUBLIC_ID,
          name: 'runtime'
        });
      }
    },
    
    resolveId(id) {
      if (id === RUNTIME_PUBLIC_ID) return RUNTIME_INTERNAL_ID;
      if (id.startsWith(`${RUNNER_PUBLIC_ID}:`)) return '\0' + id;
    },
    
    load(id) {
      if (id === RUNTIME_INTERNAL_ID) {
        return runtime({initName, pageRoot});
      }

      if (id.startsWith(`\0${RUNNER_PUBLIC_ID}:`)) {
        const name = id.substring(`\0${RUNNER_PUBLIC_ID}:`.length);
        
        let initImportPath = null;
        const extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.mts'];
        for (const ext of extensions) {
          if (fs.existsSync(path.join(viteConfig.root, 'src', initName + ext))) {
            initImportPath = `/src/${initName}` + ext;
            break;
          }
        }

        const globalPropsCode = initImportPath 
          ? `
            async function getGlobalProps() {
              try {
                const init = await import('${initImportPath}');
                return (init && typeof init.main === 'function') ? await init.main() : {};
              } catch (e) { return {}; }
            }
          `
          : `async function getGlobalProps() { return {}; }`;

        return `
          import { renderToString, FUNCTIONAL_COMPONENT_NODE } from '${renderToStringPath}';
          import * as mod from '/src/${pageRoot}/${name}';
          
          ${globalPropsCode}

          export const run = async (slot) => {
            const Component = mod.App || mod.default;
            const props = { ...(await getGlobalProps()), ...(typeof mod.main === 'function' ? await mod.main() : {}) };
            const node = {
              nodeType: FUNCTIONAL_COMPONENT_NODE,
              type: Component,
              props: { ...props, children: slot ? { innerHTML: slot } : undefined }
            };
            const html = renderToString(node);
            const { extractCritical } = await import('@emotion/server');
            return { html, ...extractCritical(html) };
          };
        `;
      }
    },

    //
    async transformIndexHtml(html, ctx) {
      let server = ctx?.server;
      
      const islandRegex = /<([a-z0-9]+)[^>]+data-island="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g;
      const matches = Array.from(html.matchAll(islandRegex));
      
      if (!matches.length) return html; // no island

      if (!runner) {
        if (!devServer && !this._server) {
          server = await createServer({
            root: viteConfig.root,
            configFile: viteConfig.configFile,
            server: { middlewareMode: true, hmr: false },
            optimizeDeps: { 
              noDiscovery: true,
              include: []
            },
            ssr: {
              external: ['@emotion/css', '@emotion/server']
            },
            plugins: [potateVite()]
          });
          localServer = server;
        }
        const nodeServer = new ViteNodeServer(server);
        runner = new ViteNodeRunner({
          root: server.config.root,
          fetchModule: id => nodeServer.fetchModule(id),
          resolveId: (id, importer) => nodeServer.resolveId(id, importer),
        });
      }

      let allIds = new Set();
      let allCss = "";
      let processedHtml = html;

      for (const [fullTag, tagName, name, slot] of matches) {
        const mod = await runner.executeId(`${RUNNER_PUBLIC_ID}:${name}`);

        const { html: appHtml, css, ids } = await mod.run(slot);
        ids?.forEach(id => allIds.add(id));
        if (css) allCss += css;

        const openTagMatch = fullTag.match(/^<[^>]+>/);
        if (openTagMatch) {
          const openTag = openTagMatch[0];
          processedHtml = processedHtml.replace(fullTag, `${openTag}${appHtml}</${tagName}>`);
        }
      }

      let headStyleChildren = false;
      const tags = [];
      if (allCss) {
        if (!devServer) {
          // Build mode: Use emitFile to let Vite handle the asset creation
          const hash = crypto.createHash('md5').update(allCss).digest('hex').slice(0, 8);
          const fileName = path.posix.join(viteConfig.build.assetsDir, `p${hash}e.css`);
          this.emitFile({ type: 'asset', fileName, source: allCss });
          tags.push({ tag: 'link', attrs: { rel: 'stylesheet', href: path.posix.join(viteConfig.base, fileName) }, injectTo: 'head' });
          headStyleChildren = '' // id only
        } else {
          headStyleChildren = allCss; // Dev mode: Inject as style tag
        }
      }

      // Hybrid?
      if (/\sdata-client(=|[\s>])/.test(processedHtml)) {

        if (headStyleChildren !== false) {
          tags.push({
            tag: 'style',
            attrs: { 'data-emotion': `css ${Array.from(allIds).join(' ')}` },
            children: headStyleChildren,
            injectTo: 'head'
          });
        }

        let src;
        if (ctx?.server) {
          // Dev mode: Vite dev server handles virtual modules via /@id/
          src = `/@id/${RUNTIME_PUBLIC_ID}`;
        } else if (runtimeRefId) {
          // Build mode: Emit as a chunk to get a real file path
          src = path.posix.join(viteConfig.base, this.getFileName(runtimeRefId));
        }

        if (src) {
          tags.push({
            tag: 'script',
            attrs: { type: 'module', src },
            injectTo: 'body'
          });
        }
      }

      return { html: processedHtml, tags };
    },

    async closeBundle() {
      if (localServer) {
        await localServer.close();
        localServer = null;
      }
    }
  }
}
