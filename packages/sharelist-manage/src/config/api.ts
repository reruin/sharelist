const api: Array<unknown> = [
  ['siginin', 'POST /signin'],
  ['list', 'GET /api/drive/path/:path'],
  ['setting', 'GET /api/setting', { token: true }],
  ['exportSetting', 'GET /api/setting?raw=true', { token: true }],
  ['saveSetting', 'POST /api/setting', { token: true }],
  ['config', 'GET /api/configs'],
  ['clearCache', 'PUT /api/cache/clear', { token: true }],
  ['reload', 'PUT /api/reload', { token: true }],
  //
  ['file', 'POST /api/drive/file/get', { token: true }],
  ['files', 'POST /api/drive/file/list', { token: true }],
  ['filePath', 'POST /api/drive/file/path', { token: true }],
  ['fileUpdate', 'POST /api/drive/file/update', { token: true }],
  ['fileDelete', 'POST /api/drive/file/delete', { token: true }],

  ['fileCreateUpload', 'POST /api/drive/file/create_upload', { token: true }],
  [
    'fileUpload',
    'POST /api/drive/file/upload?id=:id&name=:name&size=:size&hash=:hash&hash_type=:hash_type&upload_id=:uploadId',
    { token: true, contentType: 'stream' },
  ],
  ['fileUploadCancel', 'GET /api/drive/file/cancel_upload/:$1?t=:$R', { token: true }],
  ['fileHashDownload', 'POST /api/drive/file/hash_save', { token: true }],
  ['mkdir', 'POST /api/drive/file/mkdir', { token: true }],

  ['diskDelete', 'POST /api/drive/disk/delete', { token: true }],

  ['tasks', 'GET /api/drive/tasks?t=:$R', { token: true }],
  ['task', 'GET /api/drive/task/transfer/:$1?t=:$R', { token: true }],
  ['resumeTask', 'PUT /api/drive/task/transfer/:$1/resume?t=:$R', { token: true }],
  ['pauseTask', 'PUT /api/drive/task/transfer/:$1/pause?t=:$R', { token: true }],
  ['removeTask', 'DELETE /api/drive/task/transfer/:$1', { token: true }],
  ['retryTask', 'PUT /api/drive/task/transfer/:$1/retry', { token: true }],
  ['remoteDownload', 'POST /api/drive/task/remote_download', { token: true }],
  ['pauseDownload', 'PUT /api/drive/task/remote_download/:$1/pause', { token: true }],
  ['resumeDownload', 'PUT /api/drive/task/remote_download/:$1/resume', { token: true }],
  ['removeDownloadTask', 'DELETE /api/drive/task/remote_download/:$1', { token: true }],

  ['fileMove', 'POST /api/drive/move', { token: true }],
  ['plugin', 'GET /api/plugin/:$1?t=:$R', { token: true }],
  ['savePlugin', 'POST /api/plugin', { token: true }],
  ['pluginStore', 'POST /api/plugin_store', { token: true }],
  ['removePlugin', 'DELETE /api/plugin/:$1?t=:$R', { token: true }],
  ['upgradePlugin', 'PUT /api/plugin/:$1/upgrade', { token: true }],
  ['installPlugin', 'POST /api/plugin_store/install', { token: true }],
  // ['parents', 'GET /api/drive/files/:fileId/parents', { token: true }],
]
export default api
