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
  path: DrivePath
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
