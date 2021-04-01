# WebDAV

由 [drive.webdav.js](https://github.com/reruin/sharelist/tree/master/plugins/drive.webdav.js) 插件实现，用于访问WebDAV服务。    
允许的挂载路径 
```挂载路径
https://webdavserver.com:1222/path   
https://username:password@webdavserver.com:1222/path   
https://username:password@webdavserver.com:1222/?acceptRanges=none
```
!> **注意：若服务端不支持断点续传，需追加```acceptRanges=none```** 
