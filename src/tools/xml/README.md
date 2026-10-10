# XML 格式化 / 校验

[在线使用](https://niu-hb.github.io/#/tools/xml) · [返回工具清单](../../../README.md)

## 功能与使用

格式化、压缩并检查 XML 语法。

## 规则与限制

XML 检查格式是否良好，不做 XSD/DTD 校验，不接受 DOCTYPE。

格式化/压缩保留注释、CDATA、混合文本及 `xml:space="preserve"`；含文本的子树保持原布局，压缩不保证去掉所有换行。

最多 200,000 字符、100 层嵌套。

## 实现说明

使用浏览器标准 DOMParser / XMLSerializer。测试使用 jsdom 验证解析行为。
