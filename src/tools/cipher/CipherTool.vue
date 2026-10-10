<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { ElCheckbox } from 'element-plus/es/components/checkbox/index'
import { ElSelect, ElOption } from 'element-plus/es/components/select/index'
import { cipherAlgorithms, generateAesKey, generateCipherIv, validateCipherInput, type CipherAlgorithm, type CipherFormat, type CipherInput, type CipherMessage, type CipherOperation, type CipherOutput, type CipherTask } from './logic'
import CipherWorker from './worker?worker'

const algorithm = ref<CipherAlgorithm>('AES-GCM')
const operation = ref<CipherOperation>('encrypt')
const format = ref<CipherFormat>('base64')
const input = ref('')
const keyHex = ref('')
const ivHex = ref('')
const aad = ref('')
const label = ref('')
const publicKey = ref('')
const privateKey = ref('')
const aesBits = ref(256)
const rsaBits = ref(2048)
const autoIv = ref(true)
const output = ref<CipherOutput | null>(null)
const busy = ref(false)
const busyLabel = ref('')
const error = ref('')
const feedback = ref('')
const rsa = computed(() => algorithm.value === 'RSA-OAEP')
const profile = computed(() => cipherAlgorithms.find(item => item.value === algorithm.value)!)
let worker: InstanceType<typeof window.Worker> | undefined

/** 终止后台任务；无参数、无返回值，防止输入改变后旧任务覆盖当前内容。 */
function stop(): void {
  worker?.terminate()
  worker = undefined
  busy.value = false
}
onBeforeUnmount(stop)
watch([algorithm, operation, format, input, keyHex, ivHex, aad, label, publicKey, privateKey, autoIv, rsaBits], () => {
  stop()
  output.value = null
  error.value = ''
  feedback.value = ''
}, { flush: 'sync' })
watch(algorithm, () => { ivHex.value = '' })

/** 创建当前配置快照；无参数，返回仅供后台任务使用的配置，不存储密钥。 */
function settings(): CipherInput {
  return { algorithm: algorithm.value, operation: operation.value, format: format.value, text: input.value, keyHex: keyHex.value, ivHex: ivHex.value, aad: aad.value, rsaKey: operation.value === 'encrypt' ? publicKey.value : privateKey.value, label: label.value }
}

/** 启动独立任务；task 为加解密或生成密钥、message 为等待提示，无返回值，处理旧任务及后台错误。 */
function startTask(task: CipherTask, message: string): void {
  stop()
  output.value = null
  error.value = ''
  feedback.value = ''
  try {
    const active = new CipherWorker()
    worker = active
    busy.value = true
    busyLabel.value = message
    active.onmessage = event => {
      if (worker !== active) return
      const result: CipherMessage = event.data
      if (result.type === 'result') output.value = result.output
      else if (result.type === 'keys') {
        publicKey.value = result.keys.publicKey
        privateKey.value = result.keys.privateKey
        feedback.value = 'RSA 公私钥已生成，请妥善保存；离开页面不会保留密钥'
      } else error.value = result.error
      stop()
    }
    active.onerror = () => {
      if (worker !== active) return
      error.value = '后台运算失败，请使用支持 Web Crypto 的浏览器重试'
      stop()
    }
    active.postMessage(task)
  } catch {
    stop()
    error.value = '无法启动后台任务，请检查浏览器支持'
  }
}

/** 生成 AES 密钥或参数；kind 决定密钥或 IV，无返回值，随机数获取失败时反馈原因。 */
function randomize(kind: 'key' | 'iv'): void {
  try {
    if (kind === 'key') keyHex.value = generateAesKey(aesBits.value)
    else ivHex.value = generateCipherIv(algorithm.value)
    feedback.value = kind === 'key' ? '随机密钥已生成，解密时需要同一密钥' : '随机 IV / 计数块已生成'
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '随机参数生成失败' }
}

/** 校验并加解密；无参数、无返回值，默认加密时重新生成随机 IV，解密时使用已填写参数。 */
function run(): void {
  stop()
  output.value = null
  error.value = ''
  feedback.value = ''
  try {
    if (!rsa.value && operation.value === 'encrypt' && autoIv.value) ivHex.value = generateCipherIv(algorithm.value)
    const snapshot = settings()
    validateCipherInput(snapshot)
    startTask({ type: 'transform', input: snapshot }, operation.value === 'encrypt' ? '正在加密…' : '正在解密…')
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '参数校验失败' }
}

/** 取消等待后台结果；无参数、无返回值，保留输入和参数供再次执行。 */
function cancel(): void {
  stop()
  feedback.value = '已取消任务'
}

/** 将结果移至输入并切换方向；无参数、无返回值，保留同一密钥与 IV，便于验证往返转换。 */
function reuseOutput(): void {
  if (!output.value) return
  const result = output.value
  input.value = result.text
  operation.value = result.operation === 'encrypt' ? 'decrypt' : 'encrypt'
}

/** 复制用户选择的内容；text 为当前结果或 PEM，无返回值，失败显示手动复制提示。 */
async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    feedback.value = '已复制'
  } catch { feedback.value = '复制失败，请手动选择内容复制' }
}

/** 清空页面敏感数据；无参数、无返回值，终止任务并移除输入、密钥及结果，不操作浏览器存档。 */
function clearAll(): void {
  stop()
  input.value = ''
  keyHex.value = ''
  ivHex.value = ''
  aad.value = ''
  label.value = ''
  publicKey.value = ''
  privateKey.value = ''
  output.value = null
  error.value = ''
  feedback.value = '输入、密钥和结果已清空'
}
</script>

<template>
  <section class="tool-surface">
    <div class="cipher-top">
      <label class="form-field">算法<ElSelect
        v-model="algorithm"
        aria-label="加密算法"
      ><ElOption
        v-for="item in cipherAlgorithms"
        :key="item.value"
        :value="item.value"
        :label="item.label"
      /></ElSelect></label>
      <label class="form-field">操作<ElSelect
        v-model="operation"
        aria-label="加解密操作"
      ><ElOption
        value="encrypt"
        label="加密"
      /><ElOption
        value="decrypt"
        label="解密"
      /></ElSelect></label>
      <label class="form-field">密文格式<ElSelect
        v-model="format"
        aria-label="密文格式"
      ><ElOption
        value="base64"
        label="Base64"
      /><ElOption
        value="hex"
        label="Hex"
      /></ElSelect></label>
    </div>
    <p class="cipher-profile">
      {{ profile.description }}
    </p>

    <div
      v-if="!rsa"
      class="cipher-parameters"
    >
      <div class="cipher-key">
        <label class="form-field">AES 密钥（Hex，16 / 24 / 32 字节）<ElInput
          v-model="keyHex"
          type="password"
          show-password
          autocomplete="off"
          aria-label="AES 密钥"
          placeholder="输入原始密钥的 Hex，或点击生成随机密钥"
        /></label>
        <div class="toolbar">
          <ElSelect
            v-model="aesBits"
            aria-label="生成 AES 密钥长度"
            class="small-select"
          >
            <ElOption
              v-for="bits in [128, 192, 256]"
              :key="bits"
              :value="bits"
              :label="`${bits} bit`"
            />
          </ElSelect>
          <ElButton @click="randomize('key')">
            生成随机密钥
          </ElButton>
        </div>
      </div>
      <div class="cipher-iv">
        <label class="form-field">{{ algorithm === 'AES-CTR' ? '初始计数块' : 'IV' }}（Hex，{{ algorithm === 'AES-GCM' ? 12 : 16 }} 字节）<ElInput
          v-model="ivHex"
          aria-label="IV 或计数块"
          :disabled="operation === 'encrypt' && autoIv"
          placeholder="解密时填入加密所用的原始参数"
        /></label>
        <div class="toolbar">
          <ElCheckbox
            v-model="autoIv"
            :disabled="operation === 'decrypt'"
          >
            每次加密生成新 IV / 计数块
          </ElCheckbox><ElButton
            :disabled="operation === 'encrypt' && autoIv"
            @click="randomize('iv')"
          >
            生成随机参数
          </ElButton>
        </div>
      </div>
      <label
        v-if="algorithm === 'AES-GCM'"
        class="form-field cipher-aad"
      >附加认证数据 AAD（UTF-8，可选）<ElInput
        v-model="aad"
        aria-label="附加认证数据 AAD"
        placeholder="不加密；解密时须与加密时完全一致"
      /></label>
    </div>

    <div
      v-else
      class="rsa-parameters"
    >
      <div class="toolbar">
        <ElSelect
          v-model="rsaBits"
          aria-label="生成 RSA 密钥长度"
        >
          <ElOption
            v-for="bits in [2048, 3072, 4096]"
            :key="bits"
            :value="bits"
            :label="`${bits} bit`"
          />
        </ElSelect><ElButton
          :disabled="busy"
          @click="startTask({ type: 'generate-rsa', bits: rsaBits }, '正在生成 RSA 公私钥…')"
        >
          生成 RSA 公私钥
        </ElButton>
      </div>
      <div class="rsa-key-grid">
        <div>
          <div class="panel-header">
            <label for="rsa-public">SPKI 公钥（加密使用）</label><ElButton
              text
              :disabled="!publicKey"
              @click="copy(publicKey)"
            >
              复制公钥
            </ElButton>
          </div><ElInput
            id="rsa-public"
            v-model="publicKey"
            type="textarea"
            :rows="5"
            aria-label="RSA 公钥"
            placeholder="-----BEGIN PUBLIC KEY-----"
          />
        </div>
        <div>
          <div class="panel-header">
            <label for="rsa-private">PKCS#8 私钥（解密使用）</label><ElButton
              text
              :disabled="!privateKey"
              @click="copy(privateKey)"
            >
              复制私钥
            </ElButton>
          </div><ElInput
            id="rsa-private"
            v-model="privateKey"
            type="textarea"
            :rows="5"
            aria-label="RSA 私钥"
            placeholder="-----BEGIN PRIVATE KEY-----"
          />
        </div>
      </div>
      <label class="form-field">OAEP Label（UTF-8，可选）<ElInput
        v-model="label"
        aria-label="OAEP Label"
        placeholder="解密时须与加密时完全一致"
      /></label>
      <p class="muted">
        RSA-OAEP / SHA-256 的明文上限：2048 bit 为 190 字节，3072 bit 为 318 字节，4096 bit 为 446 字节。
      </p>
    </div>

    <div class="cipher-workbench">
      <div>
        <div class="panel-header">
          <label for="cipher-input">{{ operation === 'encrypt' ? '明文（UTF-8）' : `密文（${format === 'hex' ? 'Hex' : 'Base64'}）` }}</label><ElButton
            text
            @click="input = ''"
          >
            清空输入
          </ElButton>
        </div><ElInput
          id="cipher-input"
          v-model="input"
          type="textarea"
          :rows="8"
          aria-label="加解密输入"
          :placeholder="operation === 'encrypt' ? '输入文本，保留空格与换行；AES 最多 64 KiB' : '粘贴密文，并填写相同的算法、密钥和参数'"
        />
      </div>
      <div>
        <div class="panel-header">
          <label for="cipher-output">{{ operation === 'encrypt' ? '密文结果' : '解密明文' }}</label><ElButton
            text
            :disabled="!output"
            @click="copy(output!.text)"
          >
            复制结果
          </ElButton>
        </div><ElInput
          id="cipher-output"
          :model-value="output?.text ?? ''"
          type="textarea"
          :rows="8"
          readonly
          aria-label="加解密结果"
          placeholder="完成运算后显示结果"
        />
      </div>
    </div>
    <div class="toolbar cipher-actions">
      <ElButton
        type="primary"
        :disabled="busy"
        @click="run"
      >
        {{ operation === 'encrypt' ? '开始加密' : '开始解密' }}
      </ElButton>
      <ElButton
        v-if="busy"
        @click="cancel"
      >
        取消任务
      </ElButton>
      <ElButton
        :disabled="!output || busy"
        @click="reuseOutput"
      >
        将结果作为{{ (output?.operation ?? operation) === 'encrypt' ? '解密' : '加密' }}输入
      </ElButton>
      <ElButton @click="clearAll">
        清空输入与密钥
      </ElButton>
      <span
        v-if="busy"
        class="muted"
        role="status"
      >{{ busyLabel }}</span>
    </div>
    <p
      v-if="output"
      class="muted"
    >
      输入 {{ output.inputBytes.toLocaleString() }} 字节 · 输出 {{ output.outputBytes.toLocaleString() }} 字节
    </p>
    <p
      v-if="error"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-if="feedback"
      class="feedback"
      role="status"
    >
      {{ feedback }}
    </p>
    <div class="tool-notes">
      <p>密钥与口令不同：AES 需要原始密钥的 Hex，本工具不自动从普通口令派生密钥。密文不包含 IV / 计数块；GCM 密文末尾包含 16 字节认证标签。请另行保存解密所需参数和密钥。</p>
      <p>GCM 同一密钥下不能重复 IV，CTR 同一密钥下不能重复计数块；默认每次加密使用新随机参数。CBC / CTR 不验证完整性，错误参数可能得到无错误提示的乱码，不能据此确认密文未被篡改。</p>
      <p>RSA 只接受 SPKI 公钥和未加密 PKCS#8 私钥，不使用 PKCS#1 v1.5 填充。所有数据仅在当前浏览器处理，不保存、不上传；离开页面会丢失密钥，请妥善保管。</p>
    </div>
  </section>
</template>

<style scoped>
.cipher-top { display: grid; grid-template-columns: minmax(0, 2fr) repeat(2, minmax(0, 1fr)); gap: 16px; }
.cipher-top .el-select { width: 100%; }
.cipher-profile { padding: 14px 18px; background: #f3f7ed; border-radius: 10px; color: #4e674d; font-size: 13px; line-height: 1.8; }
.cipher-parameters, .rsa-key-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.cipher-parameters .toolbar { margin: 12px 0 0; }
.cipher-aad { grid-column: 1 / -1; }
.cipher-iv .el-checkbox { white-space: normal; height: auto; }
.rsa-key-grid { margin-bottom: 18px; }
.cipher-workbench { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin-top: 22px; }
.cipher-workbench > div, .rsa-key-grid > div { min-width: 0; }
.cipher-actions { margin: 22px 0 12px; }
@media (max-width: 760px) { .cipher-top { grid-template-columns: repeat(2, minmax(0, 1fr)); } .cipher-top > :first-child { grid-column: 1 / -1; } .cipher-parameters, .rsa-key-grid, .cipher-workbench { grid-template-columns: 1fr; } }
</style>
