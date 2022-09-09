import { ref, Ref } from 'vue'

export const isDocumentVisible = (): boolean => {
  return document?.visibilityState !== 'hidden'
}

const docListeners: Array<() => any> = []

export const documentVisibility = ref(!document?.hidden)
window.addEventListener(
  'visibilitychange',
  () => {
    documentVisibility.value = !document.hidden

    if (documentVisibility.value) {
      for (let i = 0; i < docListeners.length; i++) {
        const listener = docListeners[i]
        listener()
      }
    }
  },
  false,
)

export const whenDocumentVisible = (listener: () => any): (() => void) => {
  docListeners.push(listener)
  return function unsubscribe() {
    const index = docListeners.indexOf(listener)
    docListeners.splice(index, 1)
  }
}

export const useDocumentVisibility = (): Ref<boolean> => {
  return documentVisibility
}

export const useResize = () => {

}