import { useRouter, useRoute } from 'vue-router'
import { reactive, watch } from 'vue'
import { useState } from './useHooks'
type initial = {
  params: Record<string, any>
  query: Record<string, any>
}

export default ({ params: initialParams, query: initialQuery }: initial = { params: {}, query: {} }): any => {
  const router = useRouter()
  const route = useRoute()

  const [params, updateParams] = useState({
    ...initialParams,
    ...route.params,
  })

  const [query, updateQuery] = useState({
    ...initialQuery,
    ...route.query,
  })

  const setQuery = (data: Record<string, any>) => {
    router.push({
      query: {
        ...route.query,
        ...updateQuery(data),
      },
    })
  }

  const setParams = (data: Record<string, any>) => {
    router.push({
      ...route.params,
      ...updateParams(data),
    })
  }

  const setPath = (path: string) => {
    router.push(path)
  }

  watch(() => route.params, updateParams)
  watch(() => route.query, updateQuery)

  watch(query, (nv) => {
    console.log('>>>', nv)
  })
  return { params, query, setQuery, setParams, setPath }
}
