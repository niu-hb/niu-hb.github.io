<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { ElConfigProvider } from 'element-plus/es/components/config-provider/index'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
const route = useRoute()
</script>

<template>
  <ElConfigProvider :locale="zhCn">
    <header class="site-header">
      <div class="header-inner">
        <RouterLink
          to="/"
          class="brand"
        >
          <span class="brand-mark">▦</span>个人工具站<span class="brand-caption">日常的小帮手</span>
        </RouterLink>
        <RouterLink
          to="/"
          class="header-link"
        >
          工具首页 <span aria-hidden="true">↗</span>
        </RouterLink>
      </div>
    </header>
    <main class="site-main">
      <template v-if="route.path !== '/' && route.meta.category">
        <RouterLink
          to="/"
          class="back-link"
        >
          ← 返回全部工具
        </RouterLink>
        <div class="tool-heading">
          <p class="eyebrow">
            {{ route.meta.category }}
          </p>
          <h1>{{ route.meta.title }}</h1>
          <p class="muted">
            {{ route.meta.description }}
          </p>
        </div>
      </template>
      <RouterView />
    </main>
    <footer class="site-footer">
      <span>个人工具站 · 把日常小事做简单</span><span>站内工具在浏览器本地处理输入</span>
    </footer>
  </ElConfigProvider>
</template>
