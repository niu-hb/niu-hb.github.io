# 摘要算法

[在线使用](https://niu-hb.github.io/#/tools/digest) · [返回工具清单](../../../README.md)

## 功能与使用

选择文本或文件输入，勾选算法后点击“计算摘要”。支持同时计算多种算法，单项复制或带算法名称复制全部结果。输出可切换 Hex 小写、Hex 大写和 Base64。

空文本、空文件均可计算。修改输入、切换输入模式或改变算法选择会终止当前任务并清除旧结果；只切换输出格式无需重新计算。

## 支持的算法

| 分类 | 算法 |
| --- | --- |
| MD | MD4、MD5 |
| SHA-1 / SHA-2 | SHA-1、SHA-224、SHA-256、SHA-384、SHA-512 |
| SHA-3 / Keccak | SHA3-224、SHA3-256、SHA3-384、SHA3-512、Keccak-256 |
| BLAKE | BLAKE2b-512、BLAKE2s-256、BLAKE3-256 |
| 其他摘要 | RIPEMD-160、SM3、Whirlpool |
| 非密码学校验 | CRC32（IEEE）、CRC32C（Castagnoli）、Adler32、xxHash64 |

共 22 种固定配置。BLAKE 使用无密钥模式；xxHash64 的种子固定为 0。SHA3-256 与 Keccak-256 不是同一种算法。MD 系列当前提供 MD4 / MD5，不包含 MD2 或其他未列出的变体。

## 输入与输出规则

- 文本按 UTF-8 编码，保留空格、换行，不裁剪或做 Unicode 规范化；最多 1 MiB 编码字节。浏览器文本框将输入的换行表示为 LF，因此逐字节核对文件时请使用文件模式。
- 文件直接读取原始字节，文件名、扩展名和 MIME 类型不参与计算；最大 512 MiB，每次读取 1 MiB 分块。
- Base64 编码的是摘要原始字节，不是十六进制文本；Hex 保留前导零。
- 计算在独立 Worker 中进行，支持进度反馈和取消。进度表示已处理的输入字节比例，不是耗时预测。
- 所有数据仅在当前浏览器内存中处理，不保存、不上传，不读取服务器文件。

## 适用范围

摘要用于内容指纹与校验，不是加密，不能还原原文。MD4、MD5、SHA-1 用于旧系统兼容，不适合需要抗碰撞的安全用途。CRC、Adler、xxHash 是非密码学算法，不能作为防篡改或身份认证机制。

本工具不提供 HMAC、密码存储或密钥派生功能。

## 实现说明

使用精确锁定的 [hash-wasm 4.12.0](https://github.com/Daninet/hash-wasm/tree/v4.12.0)，WebAssembly 随站点打包，不从第三方 CDN 加载。算法配置与可测试计算逻辑位于 [logic.ts](./logic.ts)。浏览器需要支持 WebAssembly 和 Web Workers。
