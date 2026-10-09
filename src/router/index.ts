import { createRouter, createWebHashHistory } from 'vue-router'
import { internalTools } from '../tools/registry'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: () => import('../views/HomePage.vue'), meta: { title: '个人工具站' } },
    ...internalTools.map(tool => ({ path: tool.path, component: tool.component, meta: { title: tool.name, description: tool.description, category: tool.category } })),
    { path: '/:pathMatch(.*)*', component: () => import('../views/NotFoundPage.vue'), meta: { title: '页面未找到' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach(to => {
  document.title = to.path === '/' ? '个人工具站' : `${String(to.meta.title)} · 个人工具站`
})

export default router
