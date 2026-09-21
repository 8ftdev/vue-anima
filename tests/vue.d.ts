declare module '*.vue' {
  import type { DefineComponent, VaporComponent } from 'vue';
  const component: DefineComponent & VaporComponent;
  export default component;
}
