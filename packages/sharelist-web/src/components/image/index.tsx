import { Image, Modal } from 'ant-design-vue'

export const showImage = (urls: Array<string>, index: number) => {
  const onVisibleChange = (e: any) => {
    console.log(e)
    if (e === false) {
      modal.destroy()
    }
  }
  const modal = Modal.confirm({
    class: 'hide-modal',
    width: '500px',
    closable: true,
    content: (
      <Image.PreviewGroup preview={{ visible: true, onVisibleChange }}  >
        {
          urls.map((url, idx) => <Image src={url} />)
        }

      </Image.PreviewGroup >
    ),
  })
}