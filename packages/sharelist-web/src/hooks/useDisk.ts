import request, { ReqResponse } from '@/utils/request'
import { ref, Ref, watch, reactive, computed } from 'vue'
import { byte, getFileType, time } from '@/utils/format'
import { useRouter, useRoute } from 'vue-router'
import { useLocalStorageState } from '@/hooks/useLocalStorage'
import { message } from 'ant-design-vue'

export type IFile = {
  id: string
  name: string
  size: number
  type: 'folder' | 'file'
  ctime: number
  mtime: number
  path: string
  extra?: any
  [key: string]: any
}

const format = (d: Array<IFile>, isSearch = false): Array<IFile> => {
  d.forEach((i) => {
    i.ext = i.name.split('.').pop()
    i.iconType = getFileType(i.name, i.type)
    i.ctimeDisplay = time(i.ctime)
    i.sizeDisplay = byte(i.size)
    if (isSearch) {
      i.isSearchResult = isSearch
    }
  })
  return d
}

const useFolderAuth = () => {
  const data = useLocalStorageState('auth', {})
  const hasAuth = (path: string) => !!data.value[path]

  const addAuth = (path: string, v: any) => {
    data.value[path] = v
  }

  const getAuth = (path: string) => {
    return data.value[path]
  }

  const removeAuth = (path: string) => {
    delete data.value[path]
  }
  return { hasAuth, addAuth, getAuth, removeAuth }
}

type IUseDisk = {
  (): any
  [key: string]: any
}

const useDisk: IUseDisk = (): any => {
  if (useDisk.instance) {
    return useDisk.instance
  }

  const router = useRouter()
  const routes = useRoute()

  const files = ref([])
  const loading = ref(false)
  const error = reactive({ code: 0, message: '' })

  const { hasAuth, addAuth, getAuth, removeAuth } = useFolderAuth()

  const paths = computed(() => {
    const ret: Array<string> = (routes.params.path as string).split('/').filter(Boolean)
    if (routes.query.search) {
      ret.push(`${routes.query.search} 的搜索结果`)
    }
    return ret
  })

  const getDiskContent = (): any => {
    loading.value = true
    const isSearch = Object.keys(routes.query).length > 0
    const params: Record<string, any> = { path: routes.params.path, ...routes.query }
    if (!params.auth && hasAuth(params.path)) params.auth = getAuth(params.path)

    request.files(params).then((resp: ReqResponse) => {
      if (resp.error) {
        error.code = resp.error.code
        error.message = resp.error.message || ''

        if (error.code == 401) {
          if (error.message) {
            message.error(error.message)
          }
          removeAuth(params.path)
        }
      } else {
        if (resp.files) {
          format(resp.files, isSearch)
          files.value = resp.files
        }
        error.code = 0
        error.message = ''

        // save auth
        if (params.auth && getAuth(params.path) != params.auth) {
          addAuth(params.path, params.auth)
        }
      }
      loading.value = false
    })
  }

  const setPath = async (data: { id?: string; path?: string; isSearchResult?: boolean }) => {
    if (data.isSearchResult) {
      const resp = await request.file({ id: data.id })
      router.push('/' + resp.path)
    } else {
      router.push('/' + data.path)
    }
  }

  watch([() => routes.params, () => routes.query], getDiskContent, { immediate: true })

  useDisk.instance = {
    getDiskContent,
    setPath,
    files,
    paths,
    loading,
    error,
  }

  return useDisk.instance
}

export default useDisk
