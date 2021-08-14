import IPC from '@/utils/ipc'

export default {
  methods: {
    data() {
      return {}
    },
    created() {
      IPC.getStatus((resp) => { })
    },
    onChange(v) {
      IPC.setStatus(v)
    },
  },
  render() {
    /*
      <a-button on-click={()=>this.link('option')} class={{'no-drag':true , 'active':this.active}}  type="link">
        <a-icon type="poweroff"  style={{fontSize:'20px'}} />
      </a-button>
    */
    return <a-switch checkedChildren="运行" unCheckedChildren="关闭" defaultChecked on-change={this.onChange} />
  },
}
