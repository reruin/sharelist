export type IAPI = [
  name: string,
  url: string | ((...args: any[]) => string),
  options?: {
    [key: string]: number | string | boolean
  },
]

const api: IAPI[] = [
  ['userConfig', 'GET /api/user_config'],
  ['file', 'POST /api/drive/file/get', { token: true }],
  ['files', 'POST /api/drive/file/list', { token: true }],
  ['filePath', 'POST /api/drive/file/path', { token: true }],
  // ['parents', 'GET /api/drive/files/:fileId/parents', { token: true }],
]
export default api
