# vue-anima

Small reactive goal-style animations for Vue, powered by the browser's Web Animations API. No animation loop, VueUse dependency, or bundled Vue runtime.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { vAnima } from 'vue-anima';

const isActive = ref(false);
</script>

<template>
  <button @click="isActive = !isActive">Toggle</button>
  <div style="opacity: 0" v-anima:[isActive]="{ opacity: 1 }">Hello</div>
</template>
```

`true` animates to the goal. `false` animates back to the element's base styles. Interrupted animations continue from the current appearance.

## Install locally

This package has not been published. Build this checkout and link it into a Vue project with Bun:

```sh
bun install
bun run build
bun link
# In your consuming project:
bun link vue-anima
```

Vue is a peer dependency. Tested with regular Vue **3.5.43**, regular Vue **3.6.0-rc.9**, and Vapor **3.6.0-rc.9**. Vapor is a prerelease API; pin your Vue/compiler versions together.

## Styles and options

Use an object for typed CSS properties, or a quoted CSS declaration string:

```vue
<div style="opacity: 0" v-anima:[isActive]="'opacity: 1'" />

<div
  style="opacity: 0; transform: translateY(12px)"
  v-anima:[isActive]="{
    styles: { opacity: 1, transform: 'translateY(0px)' },
    duration: 300,
    delay: 0,
    easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  }"
/>
```

You can keep activation in the object too:

```vue
<div
  style="opacity: 0"
  v-anima="{ active: isActive, styles: { opacity: 1 }, duration: 300 }"
/>
```

| Option     | Default                            | Meaning                                     |
| ---------- | ---------------------------------- | ------------------------------------------- |
| `styles`   | Required in options form           | Target CSS object or resolver input string  |
| `active`   | `true`                             | Used when no directive argument is supplied |
| `duration` | `250`                              | Finite nonnegative milliseconds             |
| `delay`    | `0`                                | Finite nonnegative milliseconds             |
| `easing`   | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Browser-supported CSS timing function       |

The boolean argument takes precedence over `active`. Timing changes affect the next transition; equivalent goals do not restart an animation. Numeric CSS values are serialized as supplied: use `opacity: 0.5`, but `width: '100px'`.

Directive values are JavaScript expressions: use `{ opacity: 1 }` or `'opacity: 1'`, rather than bare `opacity: 1`. Configuration belongs in the same options object; there is no separate configuration directive.

## Vapor

Use the Vapor entry point in a Vapor component:

```vue
<script setup vapor lang="ts">
import { ref } from 'vue';
import { vAnima } from 'vue-anima/vapor';

const isActive = ref(false);
</script>

<template>
  <button @click="isActive = !isActive">Toggle</button>
  <div style="opacity: 0" v-anima:[isActive]="{ opacity: 1 }">Vapor</div>
</template>
```

The regular adapter uses directive hooks. The Vapor adapter uses a post-flush effect and scope cleanup. They share the animation controller. Both boolean argument examples are compiled and exercised in the browser suite. The Vapor adapter accepts raw booleans as well as runtime getters to accommodate `vue-tsc` 3.3.11's argument type generation.

## Defaults and plugins

Create a local directive with shared timing or optional resolvers:

```ts
import { createAnima } from 'vue-anima';
// For Vapor, import createAnima from 'vue-anima/vapor'.

const vAnima = createAnima({ duration: 180, easing: 'ease-out' });
```

A resolver turns string input into a CSS property object. Return `undefined` for input it does not handle; the next resolver or CSS parser receives it. Resolvers are synchronous and run before the controller mutates styles. They must leave the element unchanged and clean up temporary DOM before returning or throwing.

```ts
import { createAnima, type GoalResolver } from 'vue-anima';

const presets: GoalResolver = (goal) => {
  if (goal === 'revealed') return { opacity: 1, transform: 'translateY(0px)' };
  return undefined;
};

const vAnima = createAnima({ resolvers: [presets] });
```

### Optional compiled class goals

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { createAnima } from 'vue-anima';
import { classGoals } from 'vue-anima/plugins/classes';

const isActive = ref(false);
const vAnima = createAnima({ resolvers: [classGoals()] });
</script>

<template>
  <button @click="isActive = !isActive">Animate</button>
  <div
    class="w-[80px] bg-red-200 p-2 opacity-50"
    v-anima:[isActive]="'w-[123px] bg-blue-300 p-6 opacity-100'"
  >
    Content
  </div>
</template>
```

The plugin accepts a complete target class list and reads the CSS your app has already compiled. A temporary sibling represents the element's current classes and another represents the target classes; their changed computed properties become the WAAPI goal. This supports multiple utilities, arbitrary values, layout, transforms, colors, and custom classes without bundling Tailwind or reproducing its theme.

The element's class attribute is never mutated. Target values are applied through the animation controller while active, then the original cascade is restored. Include every class whose active-state effect you want to retain in the target list.

Every target class must exist in an inspectable compiled stylesheet. Tailwind must detect the complete strings in source or include them through its safelist mechanism. The plugin checks the loaded CSS rules first, so a missing class produces an error instead of silently resolving to browser defaults. Browser security prevents inspection of cross-origin stylesheets without CORS.

Only styles computed on the element itself are goals. Pseudo-elements, descendant-only selectors, and CSS animations are outside the resolver's scope. Responsive and ancestor variants use the conditions that apply when the goal is measured; interaction variants such as `hover:` do not continuously retarget the directive. Browser-discrete properties still change discretely.

### Optional Vite + Tailwind build plugin

For Tailwind 4 projects, `vue-anima/plugins/vite-tailwind` can resolve static class goals during Vite's Vue transform. It reads your Tailwind entry CSS, validates the class candidates against its theme, and exports each candidate's affected CSS property names. The browser resolver still reads computed values, so responsive rules, custom properties, and inherited values use the live element's context.

```sh
bun add -d @tailwindcss/node
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { animaTailwind } from 'vue-anima/plugins/vite-tailwind';

export default defineConfig({
  plugins: [animaTailwind({ css: 'src/style.css' }), vue(), tailwindcss()],
});
```

`css` points to the Tailwind entry stylesheet relative to the Vite root. Keep your normal Tailwind/Vite setup to serve the actual CSS. The build plugin runs in Node and is not included in the browser bundle.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { createAnima } from 'vue-anima';
import { classGoals } from 'vue-anima/plugins/classes';
import manifest from 'virtual:vue-anima/tailwind';

const active = ref(false);
const vAnima = createAnima({ resolvers: [classGoals(manifest)] });
</script>

<template>
  <div class="bg-red-200" v-anima:[active]="'bg-blue-300'" />
</template>
```

For TypeScript, add `import 'vue-anima/plugins/vite-tailwind/client';` to your `vite-env.d.ts`. Import the virtual manifest in the same Vue component that contains the static goals so Vite has processed those goals before loading it. The plugin recognizes literal strings and literal `styles` values in `v-anima` expressions. Dynamic class strings use the existing runtime CSS inspection path; ensure Tailwind has generated those classes. Static goals with non-Tailwind custom classes should use the runtime resolver without this build plugin. Tailwind's design-system API used here is currently marked unstable, so pin and test your Tailwind version when upgrading.

## Behavior and limits

- Base styles come from computed CSS, including inline styles, stylesheets, inheritance, and defaults. Initial active goals apply immediately; subsequent changes animate.
- Deactivation and removed goal properties restore original inline values and priorities, letting the CSS cascade take over. Unmount cancels animations and restores owned properties.
- Reduced motion is checked on each changed goal. Without WAAPI, or with zero duration, goals apply immediately. Preference changes alone do not retarget an already-running animation.
- The browser performs interpolation. Discrete properties follow browser behavior; this package does not measure `height: auto` or add JavaScript spring physics.
- Use on HTML elements. Avoid other code, CSS transitions, CSS animations, or `!important` stylesheet rules competing for the same animated properties. Goal declarations using `!important` are rejected.
- The baseline is held during an active transition. Responsive changes are picked up after restoration and a later activation, not continuously while active.
- Imports are safe on the server. DOM work starts on the client after mounting; initially active goals are not rendered into server HTML.

## Development

```sh
bun install
bunx playwright install chromium firefox webkit
bun run check
bun run test:browser
bun run benchmark
bun run dev
```

Example benchmark results on an Apple M4 (median across three runs):

| Operation                             |   Median |      p95 |
| ------------------------------------- | -------: | -------: |
| Fresh Vite plugin: analyze + manifest | 1.586 ms | 7.467 ms |
| Warm component analysis               | 0.014 ms | 0.021 ms |
| Warm manifest generation              | 0.009 ms | 0.013 ms |
| Dynamic class animation start         | 0.285 ms | 0.325 ms |
| Manifest-backed class animation start | 0.260 ms | 0.305 ms |

Browser timings are per animation in Chromium; Vite timings exclude the full app build. See [benchmark methodology](benchmarks/README.md) for sample counts and the reproducible setup.

The playground is at `http://127.0.0.1:4173/`. Separate fixtures are at `/tests/fixtures/vapor.html` and `/tests/fixtures/stable.html`.

`bun run check` runs strict TypeScript and template checks, typed ESLint, formatting, server-import tests, an ESM/declaration build, and gzip budgets. Browser tests verify actual WAAPI interpolation in Chromium, Firefox, and WebKit, including compiled Vue/Vapor templates and generated Tailwind CSS.

Each core entry point has a **2,048-byte gzip budget**, excluding Vue. The class plugin has its own 1,280-byte budget. Run `bun run size` for measurements of the current build. The optional resolver is not imported by either core entry point.

MIT licensed. Original implementation; VueUse's `useAnimate` was consulted as a reference, not copied.
