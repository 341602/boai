import { ref } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PlayerView from '../views/PlayerView.vue'
import ImmersivePlayerView from '../views/ImmersivePlayerView.vue'
import PlaylistView from '../views/PlaylistView.vue'
import SettingsView from '../views/SettingsView.vue'

export const lastNonPlayerRoute = ref({ name: 'home' })

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/player',
      name: 'player',
      component: PlayerView,
    },
    {
      path: '/immersive',
      name: 'immersive',
      component: ImmersivePlayerView,
    },
    {
      path: '/playlist',
      name: 'playlist',
      component: PlaylistView,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
  ],
})

router.afterEach((to) => {
  if (to.name && to.name !== 'player' && to.name !== 'immersive') {
    lastNonPlayerRoute.value = to.fullPath
  }
})

export default router
