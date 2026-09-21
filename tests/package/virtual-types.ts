import 'vue-anima/plugins/vite-tailwind/client';
import manifest from 'virtual:vue-anima/tailwind';

const properties: readonly string[] | undefined = manifest['bg-blue-300'];
export { properties };
