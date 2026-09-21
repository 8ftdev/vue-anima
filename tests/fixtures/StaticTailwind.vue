<script setup lang="ts">
import { ref } from 'vue';
import { createAnima } from '../../src/index';
import { classGoals } from '../../src/plugins/classes';
import manifest from 'virtual:vue-anima/tailwind';
const vAnima = createAnima({ resolvers: [classGoals(manifest)] });
Object.assign(window, { animaManifest: manifest });
const active = ref(false);
const dynamicGoal = ref('bg-blue-300');
</script>
<template>
  <div v-anima:[active]="'bg-blue-300 w-[123px] sm:bg-red-200'" />
  <div v-anima="{ active, styles: 'opacity-50' }" />
  <div v-anima="dynamicGoal" />
  <div v-anima="'opacity: 1'" />
</template>
