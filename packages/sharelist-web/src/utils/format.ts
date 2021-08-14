export const getFileType = (v: string, type: string): string => {
  if (type == 'folder') {
    return 'folder'
  } else {
    if (v) v = v.toLowerCase().split('.').pop() || ''
    if (['mp4', 'mpeg', 'wmv', 'webm', 'avi', 'rmvb', 'mov', 'mkv', 'f4v', 'flv'].includes(v)) {
      return 'video'
    } else if (['mp3', 'm4a', 'wav', 'wma', 'ape', 'flac', 'ogg'].includes(v)) {
      return 'audio'
    } else if (['doc', 'docx', 'wps'].includes(v)) {
      return 'word'
    } else if (['pdf'].includes(v)) {
      return 'pdf'
    } else if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf', 'txt', 'yaml', 'ini', 'cfg'].includes(v)) {
      return 'doc'
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'wmf', 'tif'].includes(v)) {
      return 'image'
    } else if (['zip', 'rar', '7z', 'tar', 'gz', 'gz2'].includes(v)) {
      return 'archive'
    } else {
      return 'other'
    }
  }
}

export const byte = (v: number): string => {
  if (v === undefined || v === null || isNaN(v)) {
    return '-'
  }

  let lo = 0

  while (v >= 1024) {
    v /= 1024
    lo++
  }

  return Math.floor(v * 100) / 100 + ' ' + ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'][lo]
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

export const isAudioSupport = (name: string): boolean => {
  const ext: string = name.split('.').pop() || ''
  return ['mp3', 'm4a', 'acc', 'wav', 'ogg'].includes(ext)
}

export const isVideoSupport = (name: string): boolean => {
  const ext: string = name.split('.').pop() || ''
  return ['mpeg', 'mp4', 'mkv'].includes(ext)
}

export const isSupportType = (name: string): string | undefined => {
  const ext: string = name.split('.').pop() || ''
  if (['mp3', 'm4a', 'acc', 'wav', 'ogg'].includes(ext)) {
    return 'audio'
  } else if (['mpeg', 'mp4', 'mkv'].includes(ext)) {
    return 'video'
  }
}
