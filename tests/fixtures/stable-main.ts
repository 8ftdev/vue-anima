import { createApp, compile, ref } from 'vue-stable';
import { vAnima } from '../../src/index';

createApp({
  directives: { anima: vAnima },
  setup(): { active: ReturnType<typeof ref<boolean>> } {
    return { active: ref(false) };
  },
  render: compile(
    '<button @click="active = !active">Toggle stable</button><div id="stable-target" style="opacity: 0" v-anima:[active]="{ styles: { opacity: 1 }, duration: 100 }">Stable Vue</div>',
  ),
}).mount('#app');
