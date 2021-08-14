export type IAPI = [
  name: string,
  url: string | ((...args: any[]) => string),
  options?: {
    [key: string]: number | string | boolean
  },
]

const api: IAPI[] = [
  ['siginin', 'POST /signin'],
  ['book', 'POST /search'],
  ['list', 'GET /api/drive/path/:path'],
  ['setting', 'GET /api/setting', { token: true }],
  ['saveSetting', 'POST /api/setting', { token: true }],
  ['config', 'GET /api/config'],
  ['clearCache', 'PUT /api/cache/clear'],
  //
  ['file', 'POST /api/drive/get', { token: true }],
  ['files', 'POST /api/drive/list', { token: true }],
  // ['parents', 'GET /api/drive/files/:fileId/parents', { token: true }],
]
export default api
