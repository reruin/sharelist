import { useApi, ReqResponse } from '@/hooks/useApi'
import { ref, Ref, watch, reactive, computed, inject, provide, getCurrentInstance, InjectionKey } from 'vue'
import { byte, getFileType, time } from '@/utils/format'
import { useLocalStorageState } from '@/hooks/useLocalStorage'
import { message } from 'ant-design-vue'
import { useRouter, useRoute, onBeforeRouteUpdate } from 'vue-router'

export type IFile = {
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

const formatItem = (i: IFile): IFile => {
  i.ext = i.name.split('.').pop()
  i.mediaType = getFileType(i.name, i.type)
  i.ctimeDisplay = time(i.ctime)
  i.sizeDisplay = byte(i.size)
  return i
}
const format = (d: Array<IFile>): Array<IFile> => {
  d.forEach(formatItem)
  return d
}

const useFolderAuth = () => {
  const data = useLocalStorageState<Record<string, any>>('auth', {})
  const hasAuth = (path?: string) => path && !!data.value[path]
  const addAuth = (path: string, v: any) => {
    data.value[path] = v
  }

  const getAuth = (path?: string) => {
    return path ? data.value[path] : undefined
  }

  const removeAuth = (path: string) => {
    delete data.value[path]
  }

  //create a auth chain.
  const geneAuth = (path = '') => {
    const paths = path.split('/')
    const ret: Record<string, string> = {}
    for (let i = 0; i < paths.length; i++) {
      const cur = paths.slice(0, i + 1).join('/')
      if (data.value[cur]) {
        const hit = data.value[cur]
        ret[hit[0]] = hit[1]
      }
    }
    return ret
  }
  return { hasAuth, addAuth, getAuth, geneAuth, removeAuth }
}

type IUseDiskOption = {
  id?: string
  new?: boolean
  routeSlient?: boolean
  base?: string
  filter?: (i: IFile) => boolean
}
type IUseDisk = {
  (options?: IUseDiskOption): any
  [key: string]: any
}
type IQuery = {
  id?: string
  name?: string
  path?: string
  search?: string
  orderBy?: string
  auth?: Record<string, string>
}

type DiskState = {
  id?: string
  path?: string
  search?: string
  nextPage?: string
  orderBy?: string
}

type IUseDiskAction = any

export const diskSymbol = Symbol() as InjectionKey<IUseDiskAction>
const useDisk: IUseDisk = (diskOptions: IUseDiskOption = {}): any => {
  if (inject(diskSymbol)) {
    return inject(diskSymbol)
  }

  const request = useApi()
  const router = useRouter()
  const files: Ref<Array<any>> = ref([])
  const loading = ref(false)
  const error = reactive({ code: 0, message: '', scope: {} })
  const diskConfig: Ref<any> = ref({})
  const current = <DiskState>reactive({ id: undefined, path: undefined, search: '', nextPage: '', orderBy: '' })
  const sortOption = useLocalStorageState<Record<string, any>>('ordeyBy', { key: 'name', type: 'asc' })

  const { hasAuth, addAuth, getAuth, removeAuth, geneAuth } = useFolderAuth()

  const basePath = diskOptions.base || ''
  const paths = computed(() => {
    const ret: Array<string> = current.path?.substring(1).split('/').filter(Boolean) || []
    if (current.search) {
      ret.push(`${current.search} 的搜索结果`)
    }
    return ret
  })

  let controller: AbortController

  const getFiles = async (options: IQuery = {}, clear = false): Promise<any> => {
    const stateChange = options.path != current.path || !!options.search || (!options.search && current.search)

    loading.value = true

    const params: Record<string, any> = {
      id: options.id,
      path: options.path,
      order_by: sortOption.value.key + ' ' + sortOption.value.type,
    }

    const auth: Record<string, string> = geneAuth(options.path)

    if (options.auth) {
      auth[options.auth.id] = options.auth.token
    }

    if (options.search) {
      params.search = options.search
    }
    params.auth = auth

    if (current.nextPage) {
      params.next_page = current.nextPage
    }

    const usePage = !!params.next_page

    controller = new AbortController()
    params.customRequest = (p: any) => {
      p.signal = controller.signal
    }

    const res: ReqResponse = await request.files(params)
    if (res.error) {
      error.code = res.error.code
      error.message = res.error.message as string
      //校验
      if (error.code == 401) {
        if (error.message) {
          message.error(error.message)
        }
        if (params.auth) {
          removeAuth(params.path)
        }
        if (res.error?.scope) {
          //多重目录校验
          if (res.error.scope.id != options.id) {
            const cur: ReqResponse = await request.filePath({ id: res.error.scope.id })
            const path = cur.map((i: IFile) => i.name).join('/')
            error.scope = { ...res.error.scope, path }
          } else {
            error.scope = { id: options.id, path: options.path }
          }
          // 目录校验通过 需要保存
          if (options.auth && options.auth.id != res.error.scope.id) {
            addAuth('/' + options.auth.path, [options.auth.id, options.auth.token])
          }
          current.id = options.id
          current.path = options.path
        }
      } else {
        current.path = options.path
        current.id = options.id
        error.message = res.error.message || ''
      }
    } else {
      if (res.files) {
        format(res.files)
        if (clear) {
          files.value = []
        }

        if (params.next_page) {
          let appendData = res.files as Array<any>
          if (diskOptions?.filter) {
            appendData = appendData.filter(diskOptions?.filter)
          }
          files.value.push(...appendData)
        } else {
          files.value = diskOptions?.filter ? res.files.filter(diskOptions?.filter) : res.files
        }
      }

      current.nextPage = res.nextPage

      diskConfig.value = Object.assign(res.config || {}, { id: res.id })

      current.path = options.path
      current.id = options.id
      current.search = options.search || undefined

      error.code = 0
      error.message = ''

      // save/update
      if (options.auth) {
        addAuth('/' + options.auth.path, [options.auth.id, options.auth.token])
      }
    }
    current.search = options.search || undefined

    if (diskOptions?.routeSlient !== true && !usePage && stateChange) {
      const target = options.path || ''

      let url = (basePath + target).replace(/\/+/g, '/')
      if (current.search) {
        url += '?search=' + current.search
      }
      router.push(url)
    }

    loading.value = false
  }

  const setPath = async ({ ...options }: IQuery = {}, reload = false) => {
    if (options.search) {
      reload = true
    } else {
      // if last route is search
      if (current.search) {
        reload = true
      }
    }

    if (options.path == current.path && !options.auth && !reload) return

    controller?.abort()

    loading.value = true

    if (options.id && !options.path) {
      const resp = await request.filePath({ id: options.id })
      options.path = '/' + resp.map((i: IFile) => i.name).join('/')
    }

    getFiles(options, true)
  }

  const setAuth = (auth: Record<string, string>) => {
    setPath({ auth, id: current.id, path: current.path })
  }

  const setSort = (key: string) => {
    if (key === sortOption.value.key) {
      sortOption.value.type = sortOption.value.type == 'asc' ? 'desc' : 'asc'
    } else {
      sortOption.value.key = key
      sortOption.value.type = 'asc'
    }
    //全部加载完毕时
    setPath({ id: current.id, path: current.path, search: current.search }, true)
  }

  const loadMore = () => {
    if (loading.value || !current.nextPage) {
      return
    }
    getFiles({
      id: current.id,
      path: current.path,
      search: current.search,
    })
  }

  const mutate = (file: IFile, isRemove = false) => {
    const idx = files.value.findIndex((i) => i.id == file.id)
    if (idx >= 0) {
      if (isRemove) {
        files.value.splice(idx, 1)
      } else {
        files.value.splice(idx, 1, file)
      }
    } else {
      files.value.unshift(formatItem(file))
    }
  }

  const instance = {
    setPath,
    files,
    paths,
    loading,
    error,
    loadMore,
    diskConfig,
    mutate,
    setAuth,
    current,
    setSort,
    sortConfig: sortOption,
  }

  provide(diskSymbol, instance)

  return instance
}

export default useDisk
