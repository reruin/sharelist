/*
 * One Drive API
 * 使用官方API挂载
 * token -x-> generateAuthUrl --code--> getToken 
 */

const name = 'OneDriveAPI'

const version = '1.0'

const protocols = ['oda']

const defaultProtocol = 'oda'

const fs = require('fs')

module.exports = ({ request, cache, getConfig, querystring, getLocation , base64 }) => {
  const folder = () => {

  }

  const file = () => {

  }
  
  return { name, version, drive: { protocols, folder, file } }
}