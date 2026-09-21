<script setup lang="ts">
import { ref } from 'vue';
import { vAnima } from '../../src/index';
const active = ref(false);
</script>
<template>
  <button @click="active = !active">Toggle</button>
  <div
    id="target"
    style="opacity: 0"
    v-anima:[active]="{ styles: { opacity: 1 }, duration: 100 }"
  >
    Animated
  </div>
</template>
