
class WebDAV {
  constructor(app) {
    this.name = 'WebDAVServer'
    this.app = app
    this.start()
  }

  start(){
    let { app } = this
    let port = app.getConfig('port')
    let path = app.getConfig('webdav_path')

    this.zeroconf = app.bonjour.publish({ name: 'ShareList WebDAV', type: 'webdav', port , txt: { path:'/webdav' } })
  }

  restart(){
    if( this.zeroconf ){
      this.app.bonjour.unpublish(this.zeroconf)
      this.zeroconf = null
    }
    this.start()
  }
}

module.exports = WebDAV