import { Image, Modal } from 'ant-design-vue'

export const showImage = (urls: Array<string>, index: number) => {
  const onVisibleChange = (e: any) => {
    if (e === false) {
      modal.destroy()
    }
  }
  const modal = Modal.confirm({
    style: { display: 'none' },
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