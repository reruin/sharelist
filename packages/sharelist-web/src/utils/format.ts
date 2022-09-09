const EXT_IMAGE = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'wmf', 'tif', 'svg', 'webp']

const EXT_AUDIO_SUPPORT = ['mp3', 'm4a', 'acc', 'wav', 'ogg', 'flac']

const EXT_VIDEO_SUPPORT = ['mp4', 'mpeg', '3gp', 'mkv']

export const getFileType = (v: string, type = 'file'): string => {
  if (type == 'folder' || type == 'drive') {
    return type
  } else {
    if (v) v = v.toLowerCase().split('.').pop() || ''
    if (['mp4', 'mpeg', 'wmv', 'webm', 'avi', 'rmvb', 'mov', 'mkv', 'f4v', 'flv'].includes(v)) {
      return 'video'
    } else if (['mp3', 'm4a', 'wav', 'wma', 'ape', 'flac', 'ogg'].includes(v)) {
      return 'audio'
    } else if (['doc', 'docx', 'wps'].includes(v)) {
      return 'word'
    } else if (['ppt', 'pptx'].includes(v)) {
      return 'ppt'
    } else if (['pdf'].includes(v)) {
      return 'pdf'
    } else if (['xls', 'xlsx', 'pdf', 'txt', 'yaml', 'yml', 'ini', 'cfg', 'xml', 'md'].includes(v)) {
      return 'doc'
    } else if (EXT_IMAGE.includes(v)) {
      return 'image'
    } else if (
      [
        'js',
        'ts',
        'css',
        'html',
        'c',
        'h',
        'cpp',
        'py',
        'java',
        'jsp',
        'php',
        'cs',
        'go',
        'swift',
        'vue',
        'rs',
        'asp',
        'sql',
      ].includes(v)
    ) {
      return 'code'
    }
    // else if (['zip', 'rar', '7z', 'tar', 'gz', 'gz2'].includes(v)) {
    //   return 'archive'
    // }
    else {
      return 'file'
    }
  }
}

export const byte = (v: number, fixed?: number): string => {
  if (v === undefined || v === null || isNaN(v)) {
    return '-'
  }

  let lo = 0

  while (v >= 1024) {
    v /= 1024
    lo++
  }

  const val = Math.floor(v * 100) / 100

  return (fixed ? val.toFixed(fixed) : val) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'][lo]
}

const fix0 = (v: any) => (v > 9 ? v : '0' + v)

export const time = (v: number): string => {
  if (!v) return '-'
  const date = new Date(v)
  const thisYear = new Date().getFullYear()
  let ret: string =
    fix0(date.getMonth() + 1) + '/' + fix0(date.getDay()) + ' ' + fix0(date.getHours()) + ':' + fix0(date.getMinutes())
  if (thisYear != date.getFullYear()) {
    ret = date.getFullYear() + '/' + ret
  }

  return ret
}

export const isMediaSupport = (name: string, type: 'audio' | 'video' | 'image'): boolean => {
  const ext: string = name.split('.').pop() || ''
  if (type == 'audio' && EXT_AUDIO_SUPPORT.includes(ext)) {
    return true
  } else if (type == 'video' && EXT_VIDEO_SUPPORT.includes(ext)) {
    return true
  } else if (type == 'image' && EXT_IMAGE.includes(ext)) {
    return true
  }
  return false
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isType = (type: string) => (obj: any) => Object.prototype.toString.call(obj) === `[object ${type}]`

export const isArray = isType('Array')

export const isObject = isType('Object')

export const isBlob = isType('Blob')

export const isString = (v: string): boolean => typeof v == 'string'

export const getBlob = (data: string, filename: string): Blob | undefined => {
  let blob
  try {
    blob = new Blob([data], { type: 'application/octet-stream' })
  } catch (e) {
    /**/
  }
  return blob
}

export const saveFile = (data: Blob | string, filename: string): void => {
  let blob: Blob | undefined
  if (isString(data as string)) {
    blob = getBlob(data as string, filename)
  } else {
    blob = data as Blob
  }

  if (isBlob(blob)) {
    const URL = window.URL || window.webkitURL

    const link = document.createElement('a')

    link.href = URL.createObjectURL(blob)
    link.download = filename

    const evt = document.createEvent('MouseEvents')
    evt.initEvent('click', false, false)
    // link.click()
    link.dispatchEvent(evt)
    URL.revokeObjectURL(link.href)
  }
}
