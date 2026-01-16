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

  let viteConfig, devServer, runner, localServer, runtimeRefId

  const RUNTIME_PUBLIC_ID = 'virtual:potate-runtime';
  const RUNTIME_INTERNAL_ID = '\0' + RUNTIME_PUBLIC_ID;

  const RUNNER_PUBLIC_ID = 'virtual:potate-runner';
  
  // Calculate path here to be available in load()
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const renderToStringPath = path.join(__dirname, 'renderToString.js').replace(/\\/g, '/');

  const virtualHtmlMap = new Set();

  return {
    name: 'potate',
    enforce: 'pre',
    config(userConfig) {
      const projectRoot = process.cwd();
      const root = userConfig.root || projectRoot;

      // MPA対応: root/index.html を確認し、src/pages 以下のコンポーネントから仮想HTMLエントリーを生成する
      const input = {};
      const pagesDir = path.resolve(root, `src/${pageRoot}`);

      // 1. 物理的なHTMLファイルは index.html のみ許可
      const indexHtml = path.resolve(root, 'index.html');
      if (!fs.existsSync(indexHtml)) {
        throw new Error(`[potate] index.html not found in root: ${root}`);
      }
      input['index'] = indexHtml;

      // 2. src/pages をスキャンして仮想HTMLを登録する (File System Routing)
      const scanPages = (dir, baseRoute = '') => {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            // _ で始まるディレクトリは除外 (例: src/pages/_components)
            if (file.startsWith('_')) continue;
            scanPages(filePath, path.join(baseRoute, file));
          } else if (/\.(jsx|tsx|js|ts)$/.test(file)) {
            const ext = path.extname(file);
            const basename = path.basename(file, ext);
            
            // _xxxx.js などのファイルは除外
            if (basename.startsWith('_')) continue;

            // ルートパスの決定
            let routeName = path.join(baseRoute, basename === 'index' ? '' : basename);
            routeName = routeName.replace(/\\/g, '/'); // Windows対応
            
            // ルート(index)は物理ファイルを使用するためスキップ
            if (!routeName || routeName === '.') continue;

            // エントリー名 (distに出力されるパス: about -> about/index.html)
            const entryName = `${routeName}/index`;

            // 仮想的なHTMLファイルパスを生成 (ViteにHTMLとして認識させるため .html で終わらせる)
            // 物理ファイルは存在しないため、resolveId/load で処理する
            const virtualPath = path.resolve(root, `${entryName}.html`);
            input[entryName] = virtualPath;
            virtualHtmlMap.add(virtualPath);
          }
        }
      };
      
      // ビルド時かつ input が未指定の場合のみスキャンを実行
      if (!userConfig.build?.rollupOptions?.input) {
        scanPages(pagesDir);
      }

      return {
        plugins: [potateVite()],
        resolve: {
          alias: {
            'react': 'potatejs',
            'react-dom': 'potatejs',
            'react/jsx-runtime': 'potatejs',
          },
        },
        ssr: {external: ['@emotion/css', '@emotion/server']},
        optimizeDeps: {exclude: ['@emotion/css', '@emotion/server']},
        build: {
          rollupOptions: {
            input
          }
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
      if (virtualHtmlMap.has(id)) {
        return id;
      }
    },
    
    load(id) {
      if (id === RUNTIME_INTERNAL_ID) {
        return runtime({initName, pageRoot});
      }

      if (virtualHtmlMap.has(id)) {
        const templatePath = path.resolve(viteConfig.root, 'index.html');
        return fs.readFileSync(templatePath, 'utf-8');
      }

      if (id.startsWith(`\0${RUNNER_PUBLIC_ID}:`)) {
        const name = id.substring(`\0${RUNNER_PUBLIC_ID}:`.length);
        const cleanName = name.startsWith('/') ? name.slice(1) : name;
        
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
          import * as mod from '/src/${pageRoot}/${cleanName}';
          
          export const client = mod.client;

          ${globalPropsCode}

          export const run = async (slot) => {
            const globalProps = await getGlobalProps();
            const pageProps = typeof mod.main === 'function' ? await mod.main() : {};
            const props = { ...globalProps, ...pageProps };

            if (mod.island) {
              const Layout = mod.island;
              const node = {
                nodeType: FUNCTIONAL_COMPONENT_NODE,
                type: Layout,
                props: { ...props }
              };
              let html = renderToString(node);
              
              const nestedIslandRegex = /<([a-z0-9]+)([^>]*?)\\s+data-island(?:="([^"]*)")?([^>]*?)>([\\s\\S]*?)<\\/\\1>/gi;
              const matches = Array.from(html.matchAll(nestedIslandRegex));
              let newHtml = '';
              let lastIndex = 0;
              
              for (const match of matches) {
                const [fullTag, tagName, attrsBefore, exportNameRaw, attrsAfter, content] = match;
                newHtml += html.substring(lastIndex, match.index);
                const exportName = exportNameRaw || 'default';
                const Component = exportName === 'default' ? (mod.App || mod.default) : mod[exportName];
                if (Component) {
                  const compNode = { nodeType: FUNCTIONAL_COMPONENT_NODE, type: Component, props: { ...props, children: content ? { innerHTML: content } : undefined } };
                  const compHtml = renderToString(compNode);
                  const hasClient = /data-client/.test(attrsBefore) || /data-client/.test(attrsAfter);
                  const newIslandValue = exportName === 'default' ? '${name}' : '${name}:' + exportName;
                  const islandAttr = hasClient ? \` data-island="\${newIslandValue}"\` : '';
                  newHtml += \`<\${tagName}\${attrsBefore}\${islandAttr}\${attrsAfter}>\${compHtml}</\${tagName}>\`;
                } else {
                  newHtml += fullTag;
                }
                lastIndex = match.index + fullTag.length;
              }
              newHtml += html.substring(lastIndex);
              const { extractCritical } = await import('@emotion/server');
              return { html: newHtml, ...extractCritical(newHtml) };
            } else {
              // Fallback: island エクスポートがない場合は、default エクスポートをメインコンテンツとして扱う
              // これにより、シンプルなページは export default だけで動作する
              const Component = mod.App || mod.default;
              if (Component) {
                const node = { nodeType: FUNCTIONAL_COMPONENT_NODE, type: Component, props: { ...props, children: slot ? { innerHTML: slot } : undefined } };
                const html = renderToString(node);
                const { extractCritical } = await import('@emotion/server');
                return { html, ...extractCritical(html) };
              }
              return { html: slot || '', ids: [], css: '' };
            }
          };
        `;
      }
    },

    //
    async transformIndexHtml(html, ctx) {
      let server = ctx?.server;

      // Mask comments to avoid matching islands inside them
      const comments = [];
      let processedHtml = html.replace(/<!--[\s\S]*?-->/g, (m) => {
        comments.push(m);
        return `<!--POTATE_COMMENT_${comments.length - 1}-->`;
      });

      const islandRegex = /<([a-z0-9]+)[^>]*data-island(?:="([^"]*)")?[^>]*>([\s\S]*?)<\/\1>/g;
      const matches = Array.from(processedHtml.matchAll(islandRegex));

      let allIds = new Set();
      let allCss = "";

      // URL (ctx.path) から対象のページコンポーネントを特定する
      // 例: /about/index.html -> src/pages/about.jsx OR src/pages/about/index.jsx
      let componentPath = null;
      let urlPath = ctx.path;
      
      const logicalDirname = path.dirname(urlPath).replace(/\\/g, '/');

      urlPath = urlPath.replace(/^\//, '').replace(/index\.html$/, '').replace(/\/$/, '');
      const pagesDir = path.resolve(viteConfig.root, 'src', pageRoot);
      
      const extensions = ['.jsx', '.tsx', '.js', '.ts'];
      const searchPaths = [
        path.join(pagesDir, urlPath || 'index'), // /about -> src/pages/about
        path.join(pagesDir, urlPath, 'index')    // /about -> src/pages/about/index
      ];

      for (const basePath of searchPaths) {
        for (const ext of extensions) {
          if (fs.existsSync(basePath + ext)) {
            componentPath = path.relative(path.join(viteConfig.root, 'src', pageRoot), basePath + ext).replace(/\\/g, '/').replace(/\.[^/.]+$/, "");
            break;
          }
        }
        if (componentPath) break;
      }

      if (matches.length === 0 && !componentPath) {
        return processedHtml.replace(/<!--POTATE_COMMENT_(\d+)-->/g, (_, i) => comments[i]);
      }

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

      if (componentPath) {
        processedHtml = processedHtml.replace(/(<[^>]*?[^\s>])\s+data-island(?:="")?([\s>])/, `$1 data-island="${componentPath}"$2`);
      }

      if (matches.length === 0 && componentPath) {
        // Full Body Injection Mode (when no data-island is found in HTML)
        const name = componentPath;
        const mod = await runner.executeId(`${RUNNER_PUBLIC_ID}:${name}`);
        const { html: appHtml, css, ids } = await mod.run();
        
        ids?.forEach(id => allIds.add(id));
        if (css) allCss += css;

        let bodyContent = appHtml;
        if (mod.client) {
          bodyContent = `<div data-island="${name}" data-client="${mod.client}">${appHtml}</div>`;
        }
        
        processedHtml = processedHtml.replace(/(<body[^>]*>)([\s\S]*?)(<\/body>)/i, `$1${bodyContent}$3`);
      } else {
        // Existing Island Mode (when data-island is present)
        for (const [fullTag, tagName, rawname, slot] of matches) {
          const cname = rawname ?? '';
          let name = cname.endsWith('/') ? cname.slice(0, -1) : cname;
  
          if (!name) {
            if (componentPath) {
              name = '/' + componentPath;
            } else {
              console.warn(`[potate] No component found for route: ${ctx.path}`);
              continue;
            }
          } else if (!name.startsWith('/')) {
            let sf = name;
            if (logicalDirname !== '/') sf = `/${name}`;
            name = logicalDirname + sf;
          }
  
          const mod = await runner.executeId(`${RUNNER_PUBLIC_ID}:${name}`);
  
          const { html: appHtml, css, ids } = await mod.run(slot);
          ids?.forEach(id => allIds.add(id));
          if (css) allCss += css;
  
          const openTagMatch = fullTag.match(/^<[^>]+>/);
          if (openTagMatch) {
            let openTag = openTagMatch[0];
  
            // コンポーネントから client 設定が export されていれば data-client 属性を注入する
            if (mod.client) {
              openTag = openTag.replace(/\s+data-island(?:="[^"]*")?/, ` data-island="${name}"`);
              if (/data-client/.test(openTag)) {
                openTag = openTag.replace(/\s+data-client(?:="[^"]*")?/, ` data-client="${mod.client}"`);
              } else {
                openTag = openTag.replace(/>$/, ` data-client="${mod.client}">`);
              }
            } else {
              openTag = openTag.replace(/\s+data-island(?:="[^"]*")?/, '');
            }
  
            processedHtml = processedHtml.replace(fullTag, `${openTag}${appHtml}</${tagName}>`);
          }
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
          headStyleChildren = '' // id only, no css
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

      // Restore comments
      processedHtml = processedHtml.replace(/<!--POTATE_COMMENT_(\d+)-->/g, (_, i) => comments[i]);

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
