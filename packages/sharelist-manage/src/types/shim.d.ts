declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare type ISetting = {
  title?: string
  index_enable?: boolean
  default_ignores?: Array<string>
  [key: string]: any
}
