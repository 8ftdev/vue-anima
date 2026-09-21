import './colors.css';
import { classGoals } from '../../src/plugins/classes';
import { createApp } from 'vue';
import Regular from './Regular.vue';
import { createController } from '../../src/controller';

Object.assign(window, { createController, classGoals });
createApp(Regular).mount('#app');
