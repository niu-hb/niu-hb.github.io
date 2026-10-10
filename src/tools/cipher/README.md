# 加密 / 解密

[在线使用](https://niu-hb.github.io/#/tools/cipher) · [返回工具清单](../../../README.md)

## 功能与使用

选择算法、加密或解密方向和密文编码，输入文本与对应密钥参数，再点击开始。支持生成随机 AES 密钥与 IV / 计数块、生成 RSA 公私钥、复制结果以及将结果直接用作反向操作输入。

工具使用浏览器原生 Web Crypto 和独立 Worker，无新增依赖。数据仅在当前浏览器内存中处理，不上传、不写入本地存档。可以取消任务；修改输入或参数会终止等待并清除旧结果。清空按钮同时移除输入、结果和页面内密钥。

## 算法与参数

| 算法 | 密钥 | 模式规则 |
| --- | --- | --- |
| AES-GCM | 128 / 192 / 256 bit | 12 字节 IV，128 bit 认证标签，可选 UTF-8 AAD |
| AES-CBC | 128 / 192 / 256 bit | 16 字节 IV，浏览器自动 PKCS#7 填充与去填充 |
| AES-CTR | 128 / 192 / 256 bit | 16 字节初始计数块，低 64 bit 递增，无填充 |
| RSA-OAEP | 生成 2048 / 3072 / 4096 bit；导入范围 2048–4096 bit | SHA-256 与 MGF1-SHA-256，可选 UTF-8 Label |

AES 密钥是原始字节的 Hex（32 / 48 / 64 位十六进制字符），不是任意口令。本工具不提供口令派生密钥。生成长度只控制新密钥，导入密钥的长度由输入字节确定。

RSA 加密使用 SPKI PEM 公钥（PUBLIC KEY），解密使用未加密 PKCS#8 PEM 私钥（PRIVATE KEY）。不支持 PKCS#1 的 RSA PUBLIC KEY / RSA PRIVATE KEY、加密 PEM、证书、JWK 或 RSA PKCS#1 v1.5 填充。

## 输入、编码与限制

- 明文按 UTF-8 编码，保留空格与换行；文本框将换行表示为 LF。AES 明文最多 64 KiB，允许空文本。
- RSA-OAEP 明文长度上限为模数字节数减 66：2048 bit 为 190 字节，3072 bit 为 318 字节，4096 bit 为 446 字节。它适用于短消息，不分块加密长文本。
- 密文使用标准 Base64（带填充）或 Hex。解码忽略空白，拒绝不规范填充、奇数位 Hex、0x 前缀及 URL-safe Base64。
- 输出为原始密文字节的编码，不包含 IV、计数块、密钥或 JSON 包装。GCM 的输出为密文后拼接 16 字节标签；CBC / CTR / RSA 没有额外包装。
- 解密必须使用相同算法、密钥及参数；GCM AAD、OAEP Label 也必须一致，二者最多 4,096 个 UTF-8 字节。
- RSA PEM 最多 8,192 个字符。工具仅展示有效 UTF-8 解密结果，不提供文件或任意二进制明文模式。

## 使用注意

默认每次 AES 加密重新生成随机 IV / 计数块，解密使用已填写的参数。关闭自动生成用于与已有数据核对参数。同一密钥下 GCM 不可复用 IV，CTR 不可复用计数块；CBC 使用不可预测的随机 IV。

GCM 会验证认证标签。CBC / CTR 不提供完整性认证，错误密钥或参数有时也会得到有效文本，不能将“解密未报错”视为内容真实或完整。

密文不是摘要或 Base64 编码的明文。请妥善保存密钥和解密参数；离开或刷新页面不会恢复这些数据。RSA 生成的新密钥对会替换页面中的旧密钥，请先保存需要保留的密钥。

## 实现与规范来源

逻辑位于 [logic.ts](./logic.ts)，使用 [Web Crypto 加解密接口](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt)。RSA 格式通过 [SPKI / PKCS#8 导入接口](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey) 处理，OAEP 长度遵循 [RFC 8017](https://www.rfc-editor.org/rfc/rfc8017)。

需要支持 Web Crypto 的现代浏览器以及 HTTPS / localhost 安全上下文。不包含 DES、3DES、RC4、SM4、ChaCha20 或其他未列出的算法。
