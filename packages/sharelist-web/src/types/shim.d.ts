declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'aplayer' {
  const aplayer: any
  export default aplayer
}

declare type ISetting = {
  title?: string
  index_enable?: boolean
  default_ignores?: Array<string>
  [key: string]: any
}
