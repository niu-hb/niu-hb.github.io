import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import { expect, it } from 'vitest'
import HomePage from './HomePage.vue'
import { internalTools } from '../tools/registry'

it('首页为所有站内工具生成真实 href，支持键盘导航和复制地址', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomePage },
      ...internalTools.map(tool => ({ path: tool.path, component: tool.component })),
    ],
  })
  const app = createSSRApp(HomePage).use(router)
  await router.push('/')
  await router.isReady()
  const html = await renderToString(app)
  for (const tool of internalTools) expect(html).toContain(`href="${tool.path}"`)
})
