<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { maxTodoCount, maxTodoLength, todoStatuses, type TodoItem, type TodoStatus } from './logic'
import { useTodos } from './useTodos'

const { items, error, feedback, ready, load, add, edit, setStatus, remove, resetUnreadable } = useTodos()
const content = ref('')
const editingId = ref<string | null>(null)
const editContent = ref('')
const statusIcons: Record<TodoStatus, string> = { pending: '○', 'in-progress': '◷', done: '✓' }
const filter = ref<TodoStatus | 'all'>('all')
const filters = [{ value: 'all' as const, label: '全部' }, ...todoStatuses]
const visibleItems = computed(() => items.value.filter(item => filter.value === 'all' || item.status === filter.value))
const doneCount = computed(() => items.value.filter(item => item.status === 'done').length)

/** 开始行内编辑；item 为已有待办，无返回值，草稿独立于已保存列表，取消时不会修改存档。 */
function startEdit(item: TodoItem): void {
  editingId.value = item.id
  editContent.value = item.content
  error.value = ''
}

/** 关闭编辑并丢弃草稿；无参数、无返回值，保持原待办与存档。 */
function cancelEdit(): void {
  editingId.value = null
  editContent.value = ''
  error.value = ''
}

/** 保存当前编辑草稿；无参数、无返回值，仅保存成功时关闭编辑，失败保留输入以便修正或重试。 */
function saveEdit(): void {
  if (editingId.value && edit(editingId.value, editContent.value)) cancelEdit()
}

/** 提交待办输入；无参数、无返回值，保存成功后清空输入并显示全部事项，失败保留输入以便重试。 */
function submit(): void {
  if (add(content.value)) {
    content.value = ''
    filter.value = 'all'
  }
}
</script>

<template>
  <section class="tool-surface todo-tool">
    <form
      class="todo-entry"
      @submit.prevent="submit"
    >
      <label for="todo-content">添加待办事项</label>
      <ElInput
        id="todo-content"
        v-model="content"
        type="textarea"
        :rows="3"
        placeholder="写下需要做的事…"
        :disabled="!ready"
        aria-describedby="todo-input-hint"
      />
      <div class="todo-entry-footer">
        <span id="todo-input-hint">每条最多 {{ maxTodoLength }} 个字符 · 最多 {{ maxTodoCount }} 条</span>
        <ElButton
          type="primary"
          native-type="submit"
          :disabled="!ready"
        >
          添加待办
        </ElButton>
      </div>
    </form>
    <p
      v-if="error"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </p>
    <div
      v-if="!ready && error"
      class="toolbar"
    >
      <ElButton @click="load">
        重新读取
      </ElButton>
      <ElButton
        type="danger"
        plain
        @click="resetUnreadable"
      >
        放弃原存档并重新开始
      </ElButton>
    </div>
    <p
      class="todo-feedback"
      role="status"
    >
      {{ feedback || '添加、编辑、修改状态和删除后自动保存' }}
    </p>
    <div class="todo-list-heading">
      <h2>事项列表 <span>{{ items.length - doneCount }} 项未完成 / 共 {{ items.length }} 项</span></h2>
      <div
        class="toolbar"
        role="group"
        aria-label="按待办状态筛选"
      >
        <ElButton
          v-for="option in filters"
          :key="option.value"
          :type="filter === option.value ? 'primary' : 'default'"
          :aria-pressed="filter === option.value"
          :disabled="editingId !== null"
          @click="filter = option.value"
        >
          {{ option.label }}
        </ElButton>
      </div>
    </div>
    <ul
      v-if="visibleItems.length"
      class="todo-list"
    >
      <li
        v-for="item in visibleItems"
        :key="item.id"
        class="todo-item"
        :class="[`status-${item.status}`, { editing: editingId === item.id }]"
      >
        <div class="todo-item-header">
          <span class="todo-status-badge">
            <span aria-hidden="true">{{ statusIcons[item.status] }}</span>
            {{ todoStatuses.find(status => status.value === item.status)?.label }}
          </span>
          <div class="todo-actions">
            <ElButton
              text
              :disabled="!ready || editingId !== null"
              :aria-label="`编辑待办：${item.content}`"
              @click="startEdit(item)"
            >
              编辑
            </ElButton>
            <ElButton
              type="danger"
              text
              :disabled="!ready || editingId === item.id"
              :aria-label="`删除待办：${item.content}`"
              @click="remove(item.id)"
            >
              删除
            </ElButton>
          </div>
        </div>
        <form
          v-if="editingId === item.id"
          class="todo-editor"
          @submit.prevent="saveEdit"
        >
          <label :for="`todo-edit-${item.id}`">编辑待办内容</label>
          <ElInput
            :id="`todo-edit-${item.id}`"
            v-model="editContent"
            type="textarea"
            :rows="3"
            @keydown.esc.prevent="cancelEdit"
          />
          <p
            v-if="error"
            class="edit-error"
          >
            {{ error }}
          </p>
          <div class="todo-editor-actions">
            <ElButton @click="cancelEdit">
              取消
            </ElButton>
            <ElButton
              type="primary"
              native-type="submit"
            >
              保存修改
            </ElButton>
          </div>
        </form>
        <p
          v-else
          class="todo-content"
        >
          {{ item.content }}
        </p>
        <div
          class="todo-status-switch"
          role="group"
          :aria-label="`待办状态：${item.content}`"
        >
          <ElButton
            v-for="status in todoStatuses"
            :key="status.value"
            :class="[`switch-${status.value}`, { selected: item.status === status.value }]"
            :aria-pressed="item.status === status.value"
            :disabled="!ready || editingId === item.id"
            @click="setStatus(item.id, status.value)"
          >
            <span
              class="switch-icon"
              aria-hidden="true"
            >{{ statusIcons[status.value] }}</span>
            {{ status.label }}
          </ElButton>
        </div>
      </li>
    </ul>
    <div
      v-else
      class="empty-state"
    >
      <p>{{ !ready ? '等待读取本地待办' : !items.length ? '还没有待办事项，添加第一件要做的事吧。' : '当前状态下没有待办事项。' }}</p>
    </div>
    <div class="tool-notes">
      <p>录入内容后点击“添加待办”。点击事项内的状态按钮切换待处理、进行中或已完成，卡片配色随状态变化；也可按状态筛选或删除事项。</p>
      <p>历史事项可点击“编辑”修改内容，点击“保存修改”写入本地，“取消”或 Esc 放弃草稿。编辑期间保留原状态，保存失败可继续修正或重试。</p>
      <p>数据保存在当前浏览器的本地存储中，刷新或重新进入页面会恢复，不上传、不跨设备同步。清除网站数据会删除待办；多个标签页同时修改时，以最后保存的列表为准。</p>
    </div>
  </section>
</template>

<style scoped>
.todo-entry { display: grid; gap: 12px; }
.todo-entry > label { font-weight: 600; }
.todo-entry-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.todo-entry-footer > span, .todo-feedback, .todo-list-heading h2 span { color: #71806f; font-size: 13px; }
.todo-feedback { min-height: 20px; margin: 12px 0 24px; }
.todo-list-heading { display: grid; gap: 12px; margin-bottom: 16px; }
.todo-list-heading h2 { margin: 0; font-size: 18px; }
.todo-list-heading h2 span { display: inline-block; margin-left: 12px; font-weight: 400; }
.todo-list-heading .toolbar { margin-bottom: 0; }
.todo-list { display: grid; gap: 14px; list-style: none; margin: 0; padding: 0; }
.todo-item { min-width: 0; display: grid; gap: 16px; padding: 16px 20px; border: 1px solid var(--todo-border); border-left: 4px solid var(--todo-accent); border-radius: 12px; background: var(--todo-background); }
.status-pending { --todo-background: #fffaf0; --todo-border: #eedfbf; --todo-accent: #99651c; --todo-text: #704c1d; --todo-badge: #f7eacc; }
.status-in-progress { --todo-background: #f1f7ff; --todo-border: #d0e1f4; --todo-accent: #326ca6; --todo-text: #28527b; --todo-badge: #dfeefa; }
.status-done { --todo-background: #f0f7f2; --todo-border: #d0e4d6; --todo-accent: #34704b; --todo-text: #466c52; --todo-badge: #dfeee3; }
.todo-item-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.todo-status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 20px; background: var(--todo-badge); color: var(--todo-accent); font-size: 12px; font-weight: 600; }
.todo-content { min-width: 0; margin: 0; color: var(--todo-text); line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
.status-done .todo-content { text-decoration: line-through; text-decoration-color: #8baa94; }
.todo-actions { display: flex; align-items: center; gap: 4px; }
.todo-actions .el-button + .el-button { margin-left: 0; }
.todo-status-switch { display: inline-flex; justify-self: start; gap: 4px; padding: 4px; border: 1px solid var(--todo-border); border-radius: 10px; background: #ffffffb3; }
.todo-status-switch .el-button { height: 32px; padding: 0 12px; margin: 0; border-color: transparent; border-radius: 7px; background: transparent; color: #657361; font-size: 12px; }
.todo-status-switch .el-button:hover { background: #edf0e9; color: #24362f; }
.todo-status-switch .selected { font-weight: 600; box-shadow: 0 1px 3px #24362f14; }
.todo-status-switch .switch-pending.selected { background: #f7eacc; color: #704c1d; border-color: #e7d3a7; }
.todo-status-switch .switch-in-progress.selected { background: #dfeefa; color: #28527b; border-color: #bad4ed; }
.todo-status-switch .switch-done.selected { background: #dfeee3; color: #29593b; border-color: #bcd8c5; }
.switch-icon { margin-right: 5px; font-size: 15px; }
.todo-editor { display: grid; gap: 10px; }
.todo-editor > label { font-size: 13px; color: var(--todo-text); }
.todo-editor-actions { display: flex; justify-content: flex-end; gap: 8px; }
.todo-editor-actions .el-button + .el-button { margin-left: 0; }
.edit-error { color: #a43a30; margin: 0; font-size: 13px; overflow-wrap: anywhere; }
@media (max-width: 600px) {
  .todo-entry-footer { align-items: flex-start; }
  .todo-item { padding: 12px; gap: 12px; }
  .todo-status-switch { display: flex; justify-self: stretch; }
  .todo-status-switch .el-button { flex: 1; padding: 0 6px; }
  .todo-list-heading h2 span { display: block; margin: 8px 0 0; }
}
</style>
