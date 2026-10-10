import { generateRsaKeys, transformCipher, type CipherMessage, type CipherTask } from './logic'

/** 在后台执行加解密或密钥生成；event 为独立任务，通过消息返回结果，错误中不包含密钥及原文。 */
self.onmessage = async (event: MessageEvent<CipherTask>) => {
  let message: CipherMessage
  try {
    const task = event.data
    if (task.type === 'transform') message = { type: 'result', output: await transformCipher(task.input) }
    else if (task.type === 'generate-rsa') message = { type: 'keys', keys: await generateRsaKeys(task.bits) }
    else throw new Error('不支持的密码学任务')
  } catch (cause) {
    message = { type: 'error', error: cause instanceof Error ? cause.message : '密码学运算失败，请重试' }
  }
  self.postMessage(message)
}
