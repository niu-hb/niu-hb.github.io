import type { AllowedComponentProps, ExtractPublicPropTypes } from 'vue'
import type { Property } from 'csstype'

// 组件库声明使用旧名称；映射到标准公共 props 类型，保留必填/可选属性推导。
declare module '@vue/runtime-core' {
  export type __ExtractPublicPropTypes<O> = ExtractPublicPropTypes<O>
}

// CSS 声明的旧平铺名称对应现代 Property 命名空间中的同一联合类型。
declare module 'csstype' {
  export type ObjectFitProperty = Property.ObjectFit
  export type ZIndexProperty = Property.ZIndex
}

// Vue 组件允许 class/style 属性，组件库的 JSX 声明也需要读取这些标准属性。
declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      class?: AllowedComponentProps['class']
      style?: AllowedComponentProps['style']
    }
  }
}
