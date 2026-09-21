<script setup vapor lang="ts">
import { ref } from 'vue';
import { vAnima } from '../../src/vapor';
const active = ref(false);
const visible = ref(true);
const goal = ref(1);
</script>
<template>
  <button @click="active = !active">Toggle Vapor</button>
  <button @click="goal = 0.5">Change Vapor goal</button>
  <button @click="visible = !visible">Unmount Vapor</button>
  <div
    v-if="visible"
    id="vapor-target"
    style="opacity: 0"
    v-anima:[active]="{ styles: { opacity: goal }, duration: 80 }"
  >
    Vapor animation
  </div>
</template>
