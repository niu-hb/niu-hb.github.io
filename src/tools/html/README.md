# HTML 格式化

[在线使用](https://niu-hb.github.io/#/tools/html) · [返回工具清单](../../../README.md)

## 功能与使用

格式化 HTML5 文档与片段。

## 规则与限制

HTML5 与 XML 的标签、属性规则不同，因此使用单独页面。

HTML 格式化按元素默认显示方式换行缩进，保留 `pre` 与行内文本的有意义空白；自定义 CSS 改变元素显示方式时需检查空白效果。

只处理源码，不执行脚本或加载资源；内嵌 JavaScript/CSS 保留，不处理 Vue/JSX 模板。

最多 200,000 字符，格式化不等于完整 HTML 规范校验。

## 实现说明

使用 Prettier 浏览器版及 HTML 插件。
