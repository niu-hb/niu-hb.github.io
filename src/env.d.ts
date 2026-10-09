// VueUse 9 引用旧名称，映射到标准屏幕方向声明，保留具体联合类型及完整检查。
type OrientationLockType = ScreenOrientationLockType

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}
