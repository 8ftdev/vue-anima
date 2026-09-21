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

### Optional Tailwind background colors

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { createAnima } from 'vue-anima';
import { classGoals } from 'vue-anima/plugins/classes';

const isActive = ref(false);
const vAnima = createAnima({ resolvers: [classGoals()] });
</script>

<template>
  <button @click="isActive = !isActive">Change color</button>
  <div class="bg-red-200" v-anima:[isActive]="'bg-blue-300'">Color</div>
</template>
```

The plugin reads your generated CSS using a temporary hidden sibling. It neither ships Tailwind nor adds target classes permanently. Target classes must be included in Tailwind's source detection or safelist; absent CSS cannot produce the desired color.

Initial support is intentionally narrow: **one unprefixed `bg-<name>-<shade>` utility** (`50`, `100`–`900`, or `950`), `bg-black`, `bg-white`, `bg-transparent`, or `bg-current`, optionally with a numeric `/opacity` suffix. It reads only `background-color`. It does not implement Tailwind conflict merging, arbitrary values, variants, pseudo-elements, layout utilities, or multiple class goals. Ancestor CSS variables work; selectors or variables that depend on the original element's ID, sibling position, or removed base classes are outside this resolver's contract.

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
bun run dev
```

The playground is at `http://127.0.0.1:4173/`. Separate fixtures are at `/tests/fixtures/vapor.html` and `/tests/fixtures/stable.html`.

`bun run check` runs strict TypeScript and template checks, typed ESLint, formatting, server-import tests, an ESM/declaration build, and gzip budgets. Browser tests verify actual WAAPI interpolation in Chromium, Firefox, and WebKit, including compiled Vue/Vapor templates and generated Tailwind CSS.

Each core entry point has a **2,048-byte gzip budget**, excluding Vue. The class plugin has its own 1,024-byte budget. Run `bun run size` for measurements of the current build. The optional resolver is not imported by either core entry point.

MIT licensed. Original implementation; VueUse's `useAnimate` was consulted as a reference, not copied.
