import { ref } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PlayerView from '../views/PlayerView.vue'
import PlaylistView from '../views/PlaylistView.vue'

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
      path: '/playlist',
      name: 'playlist',
      component: PlaylistView,
    },
  ],
})

router.afterEach((to) => {
  if (to.name && to.name !== 'player') {
    lastNonPlayerRoute.value = to.fullPath
  }
})

export default router
