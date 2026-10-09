<script setup lang="ts">
import { ref } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElSelect, ElOption } from 'element-plus/es/components/select/index'
import TextWorkbench from '../../components/TextWorkbench.vue'
import { useTextTransform } from '../useTextTransform'
import { formatXml, validateXml } from './logic'

const input = ref('')
const indent = ref<2 | 4>(2)
const { output, error, run } = useTextTransform(input, [indent])
</script>

<template>
  <section class="tool-surface">
    <div class="toolbar">
      <ElButton
        type="primary"
        @click="run(text => formatXml(text, indent))"
      >
        格式化
      </ElButton>
      <ElButton @click="run(text => formatXml(text, 0))">
        压缩
      </ElButton>
      <ElButton @click="run(validateXml)">
        语法检查
      </ElButton>
      <label for="xml-indent">缩进</label>
      <ElSelect
        id="xml-indent"
        v-model="indent"
        class="small-select"
        aria-label="XML 缩进"
      >
        <ElOption
          label="2 空格"
          :value="2"
        /><ElOption
          label="4 空格"
          :value="4"
        />
      </ElSelect>
      <ElButton @click="input = '<?xml version=&quot;1.0&quot;?><root><item id=&quot;1&quot;>你好 🌏</item><!-- 示例 --><empty/></root>'">
        填入示例
      </ElButton>
    </div>
    <TextWorkbench
      v-model="input"
      :output="output"
      :error="error"
      placeholder="请输入 XML 文档…"
    />
    <div class="tool-notes">
      <p>支持格式化、压缩与 XML 语法检查。语法检查要求单个根元素、正确闭合的标签和合法属性。</p>
      <p>保留注释、CDATA、混合文本和 xml:space="preserve" 的空白。压缩只移除可处理的排版空白，不保证删除所有换行；含文本的子树保留原布局。</p>
      <p>不支持 XSD/DTD 校验或包含 DOCTYPE 的文档。最多 200,000 字符、100 层嵌套。HTML5 请使用单独的 HTML 格式化工具。</p>
    </div>
  </section>
</template>
