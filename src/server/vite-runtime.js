// server/vite-runtime.js

export default ({initName, pageRoot}) => `
  import { createElement, render } from 'potatejs'; 
  const modules = import.meta.glob('/src/${pageRoot}/**/*.{js,ts,jsx,tsx}');
  const initModules = import.meta.glob('/src/${initName}.{js,ts}');

  async function boot() {
    let globalProps = {};
    const initKey = Object.keys(initModules)[0];
    if (initKey) {
      const initMod = await initModules[initKey]();
      if (typeof initMod.main === 'function') globalProps = await initMod.main();
    }

    const islands = document.querySelectorAll('[data-island][data-client]');
  
    for (const el of islands) {
      const { island: name, client: mode } = el.dataset;
      const path = Object.keys(modules).find(p => {
        const noExt = p.replace(/\\.[^/.]+$/, "");
        return noExt.endsWith(\`\${name}\`);
      });

      if (!path) {
        console.warn(\`[Potate] "${pageRoot}\${name}" not found.\`);
        continue;
      }

      const mod = await modules[path]();
      const Component = mod.App || mod.default;
      const localProps = typeof mod.main === 'function' ? await mod.main() : {};
      const props = { ...globalProps, ...localProps };

      const cache = document.createElement('div');
      render(createElement(Component, props), cache);
      el.replaceChildren(...Array.from(cache.childNodes));
    }
  }

  boot();
`