type ISetting = {
  theme: 'night' | 'dark'
  layout: 'list' | 'grid'
}

export type State = {
  accessToken: string
  setting: ISetting
}

export const state: State = {
  accessToken: '',
  setting: {
    theme: 'night',
    layout: 'list',
  },
}
