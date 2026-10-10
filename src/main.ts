import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import 'element-plus/theme-chalk/base.css'
import 'element-plus/theme-chalk/el-button.css'
import 'element-plus/theme-chalk/el-input.css'
import 'element-plus/theme-chalk/el-select.css'
import 'element-plus/theme-chalk/el-option.css'
import 'element-plus/es/components/dialog/style/css.mjs'
// 使用组件样式入口，同时加载颜色面板等内部组件的必要样式。
import 'element-plus/es/components/input-number/style/css.mjs'
import 'element-plus/es/components/checkbox/style/css.mjs'
import 'element-plus/es/components/color-picker/style/css.mjs'
import './styles/global.css'

createApp(App).use(router).mount('#app')
