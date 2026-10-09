<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>
<template>
  <section class="empty-state">
    <p class="eyebrow">
      404
    </p><h1>这个工具还不在工具箱里</h1><p>地址可能有误，回首页看看吧。</p><RouterLink
      to="/"
      class="back-link"
    >
      ← 返回工具首页
    </RouterLink>
  </section>
</template>
