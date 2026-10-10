# URL 编解码

[在线使用](https://niu-hb.github.io/#/tools/url) · [返回工具清单](../../../README.md)

## 功能与使用

转换完整网址或单个参数值。

## 规则与限制

URL 参数值对应 `encodeURIComponent` / `decodeURIComponent`，完整网址对应 `encodeURI` / `decodeURI`；完整模式保留 `/ ? & = #` 等结构，中文和空格会被编码，纯英文网址可能不变。

`+` 不自动转换为空格。
