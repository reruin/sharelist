type DrivePath = {
  protocol: string
  [key: string]: string | number
}

declare type DriverField = {
  key: string
  label: string
  value?: string | number | boolean
  options?: Array<any>
  type?: 'string' | 'hidden' | 'number' | 'boolean' | 'list'
  help?: string
  fields?: Array<DriverField>
  required?: boolean
}

declare type IDrive = {
  name: string
  [key: string]: string | number
}

declare type IPlugin = {
  name: string
  id: string
  [key: string]: string | number
}

declare type DriverGuide = {
  key?: string
  label?: string
  fields: Array<DriverField>
}

declare type Driver = {
  protocol: string
  name?: string
  guide?: Array<DriverField>
}

declare type IFile = {
  id: string
  name: string
  size: number
  type: 'folder' | 'file' | 'drive'
  ctime: number
  mtime: number
  path: string
  extra?: Record<string, any>
  [key: string]: any
}
