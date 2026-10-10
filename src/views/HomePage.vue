<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ElInput } from 'element-plus/es/components/input/index'
import { internalTools } from '../tools/registry'
import externalConfig from '../config/external-tools.json'
import { parseExternalTools } from '../config/external-tools'

const keyword = ref('')
const category = ref('全部工具')
let configurationError = ''
const externalTools = (() => {
  try {
    return parseExternalTools(externalConfig)
  } catch (error) {
    configurationError = error instanceof Error ? error.message : '外链配置读取失败'
    return []
  }
})()
const tools = [
  ...internalTools.map(tool => ({ ...tool, kind: 'internal' as const, url: tool.path })),
  ...externalTools.map(tool => ({ ...tool, kind: 'external' as const })),
]
const categories = ['全部工具', ...new Set(tools.map(tool => tool.category))]
const filteredTools = computed(() => tools.filter(tool =>
  (category.value === '全部工具' || tool.category === category.value) &&
  `${tool.name} ${tool.description} ${tool.category}`.toLocaleLowerCase().includes(keyword.value.trim().toLocaleLowerCase()),
))
</script>

<template>
  <section class="hero">
    <div>
      <p class="eyebrow">
        <span class="status-dot" /> YOUR EVERYDAY TOOLBOX
      </p>
      <h1>日常所需，<br><span>一站直达。</span></h1>
      <div class="hero-description">
        <p>这是我的个人工具站，收录开发、文本、编码、时间、学习、安全与趣味工具。</p>
        <p>站内工具在浏览器本地处理输入；第三方网站通过链接在新标签页打开。</p>
      </div>
      <div class="hero-meta">
        <span>{{ internalTools.length }} 个站内工具</span><span>{{ externalTools.length }} 个第三方网站</span><span>站内工具免费</span>
      </div>
    </div>
    <div
      class="hero-art"
      aria-hidden="true"
    >
      <div class="art-label">
        小工具，大方便
      </div>
      <div class="art-grid">
        <span>{ }</span><span>◷</span><span>↗</span><span>Aa</span>
      </div>
      <div class="art-caption">
        READY WHEN YOU ARE.
      </div>
    </div>
  </section>
  <section
    class="catalog"
    aria-labelledby="catalog-title"
  >
    <div class="catalog-heading">
      <div>
        <p class="eyebrow">
          THE COLLECTION
        </p><h2 id="catalog-title">
          工具清单 <span class="count-badge">{{ tools.length }}</span>
        </h2>
      </div><ElInput
        v-model="keyword"
        aria-label="搜索工具"
        placeholder="搜索名称、用途或分类…"
        clearable
        class="search-input"
      />
    </div>
    <div
      class="category-tabs"
      aria-label="按分类筛选"
    >
      <button
        v-for="item in categories"
        :key="item"
        :class="{ active: category === item }"
        :aria-pressed="category === item"
        @click="category = item"
      >
        {{ item }}
      </button>
    </div>
    <p
      v-if="configurationError"
      class="error-message"
      role="alert"
    >
      第三方工具配置有误：{{ configurationError }}
    </p>
    <div class="tool-grid">
      <component
        :is="tool.kind === 'internal' ? RouterLink : 'a'"
        v-for="(tool, index) in filteredTools"
        :key="`${tool.kind}-${tool.id}`"
        v-bind="tool.kind === 'internal' ? { to: tool.url } : { href: tool.url, target: '_blank', rel: 'noopener noreferrer' }"
        class="tool-card"
      >
        <div class="card-top">
          <span
            class="tool-icon"
            :class="`tone-${index % 4}`"
          ><img
            v-if="tool.kind === 'external'"
            :src="tool.icon"
            alt=""
            loading="lazy"
            referrerpolicy="no-referrer"
          ><template v-else>{{ tool.icon }}</template></span><span class="kind-badge">{{ tool.kind === 'internal' ? '站内工具' : '第三方网站 ↗' }}</span>
        </div>
        <h3>{{ tool.name }}</h3><p>{{ tool.description }}</p>
        <div class="card-bottom">
          <span>{{ tool.category }}</span><span aria-hidden="true">↗</span>
        </div>
      </component>
    </div>
    <div
      v-if="!filteredTools.length"
      class="empty-state"
    >
      <h3>没有找到匹配的工具</h3><p>试试其他关键词，或切换到全部工具。</p>
    </div>
    <div class="collection-note">
      <span class="status-dot" /><p>第三方网站的功能、使用限制及收费规则以对应网站为准。</p>
    </div>
  </section>
</template>
