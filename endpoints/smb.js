const SMBServer = require('@sharelist/node-smb-server')
const lm = require('@sharelist/node-smb-server/lib/ntlm').lm
const ntlm = require('@sharelist/node-smb-server/lib/ntlm').ntlm

const getDefaultConfig = (app) => {
  let port = app.getConfig('smb_server_port') || 8445
  let allowAnonymous = !!app.getConfig('smb_anonymous_enable') || true
  let token = app.getConfig('token')
  let users = {
   "admin" : {
      "lmHash" : lm.createHash(token).toString('hex'),
      "ntlmHash" : ntlm.createHash(token).toString('hex')
    }
  }
  if( allowAnonymous ){
    users.guest = {
      "lmHash" : "aad3b435b51404eeaad3b435b51404ee",
      "ntlmHash" : "31d6cfe0d16ae931b73c59d7e0c089c0"
    }
  }
  return {
    "listen": {
      "port": port,
      "host": "0.0.0.0"
    },
    "smb2Support": false,
    "domainName": "WORKGROUP",
    "extendedSecurity": true,
    "allowAnonymous":allowAnonymous,
    "users": users,
    "shares": {
      "SL": {
        "backend": "sharelist",
        "description": "sharelist share",
        "instance":app
      }
    }
  }
}
class SMB {
  constructor(app) {
    this.name = 'SMBServer'
    this.app = app
    this.start()
  }

  start(){
    let enable = this.app.getConfig('smb_server_enable')
    if( enable ){
      let config = getDefaultConfig(this.app)
      this.config = config
      this.server = new SMBServer(config, null)

      this.server.start(config.listen.port,config.listen.host, () => {
        this.onStart()
      });

      this.server.on('error', (err) => {
        this.onError(err)
      })
    }
  }

  onStart(){
    console.log('smb is running at :'+this.config.listen.port)
  }

  onError(err){
    if (err) {
      console.error('error during startup %s', err.message);
    }
  }

  restart(){
    try{
      if( this.server ){
        this.server.stop(() => {
          console.log('smb has closed')
          this.server = null
          this.start()
        })
      }else{
        this.start()
      }
    }catch(e){
      console.log(e)
    }
  }
}

module.exports = SMB