
# SSR [Emotion](https://emotion.sh/docs/@emotion/css) for Vite

A natural and powerful Zero-Runtime CSS-in-JS solution, seamlessly integrated with Vite.

## **Server Side Rendering / Static Site Generation Styling (SSR / SSG Only)**

SSR Emotion for Vite は、お気に入りの SSG がない人の新しい選択肢になるかもしれません！

I used to think there wasn't much point in writing static content in JSX components (`.jsx` or `.tsx` files) instead of just using Astro components (`.astro` files). It seemed like standard Astro components were more than enough for most cases, because I thought having frontmatter, the HTML tag section, and the style section was all I ever needed.

However, I've realized one major advantage: "SSR EMOTION". While other frameworks often struggle with complex configurations to get [Emotion](https://emotion.sh/docs/@emotion/css) working with SSR, Potate bridges this gap naturally. It allows you to use the power of CSS-in-JS without any of the typical performance trade-offs.

## 💎 The Result

* **Zero Runtime by default:** No `Emotion` library is shipped to the browser. It delivers a pure Zero-JS experience.
* **Familiar DX:** Use the full expressive power of the [Emotion `css()` function](https://emotion.sh/docs/@emotion/css) that you already know.
* **Static by Default:** Styles are automatically extracted into static CSS during the Astro build process.
* **Performance:** No hydration overhead for styles and no Flash of Unstyled Content (FOUC).


## 🛠 How it looks

In Potate, you don't need to learn any special properties or complex setups. It just works with the standard `class` attribute and the [Emotion `css()` function](https://emotion.sh/docs/@emotion/css). It feels completely natural, even in Astro's **"No directive" (Server Only)** mode.

While you can use [`css()`](https://emotion.sh/docs/@emotion/css) directly, you can also create reusable functions like `flexCol()` (which we call ["The Patterns"](/docs/SSR_EMOTION_FOR_ASTRO.md#-the-patterns)).

```jsx
import { css } from '@emotion/css'

export const MyComponent = () => (
  <div class={flexCol({ 
    color: 'hotpink',
    '&:hover': { color: 'deeppink' }
  })}>
    Hello, SSR EMOTION!
  </div>
)

const flexCol = (...args) => css({
  display: 'flex',
  flexDirection: 'column',
}, ...args)

```

## 🌗 Hybrid Styling (SSR + CSR)

In Potate, Island components (`client:*`) get the best of both worlds.

### How it works

1. At Build Time (SSR): Potate executes your `css()` calls and extracts the initial styles into a static CSS file. This ensures your component looks perfect even before JavaScript loads.

2. At Runtime (Hydration): Once the Island hydrates in the browser, the Emotion runtime takes over.

### Why this is powerful

Because the Emotion runtime remains active inside Islands, you can use standard React/Preact patterns to handle dynamic styles without any special "Potate-specific" APIs.

### Example: Hydration-aware Styling

You can easily change styles when the component "wakes up" in the browser:

```jsx
// src/components/InteractiveBox.jsx

export const InteractiveBox = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true); // Triggers once JS is active
  }, []);

  return (
    <div class={css({
      // Red on server (SEO/LCP friendly), Blue once interactive!
      background: isLoaded ? 'blue' : 'red',
      transition: 'background 0.5s',
      padding: '20px'
    })}>
      {isLoaded ? 'I am Interactive!' : 'I am Static HTML'}
    </div>
  );
};

```

## **Client Side Styling (CSR Only)**

"Client Side Styling Only" は普通の Vite で作成する Web App です（よね？）
普通に emotion が使えます（よね？）

```html
  <!-- index.html -->

  <body>
    <div id="app"></div>
    <script type="module" src="/src/main"></script>
  </body>

```

```jsx
// src/main.jsx 

import Potate from 'potatejs'
import { css } from '@emotion/css'

const App = () => {
  const [color, setColor] = useState('blue');

  useEffect(() => {
    setColor('red');
  }, []);

  return (
    <div class={css({color})}>
      Hello, CSR EMOTION! It is Normal, right?
    </div>
  );
};

//
const root = Potate.createRoot(document.querySelector('#app'))
root.render(<App/>)

```
