## 接口

### 获取文件列表
```
POST /api/drive/list
```
请求参数
参数名 | 含义 | 是否必须
-|-|-
path|路径|是

返回结果
名称 | 类型 | 说明
-|-|-
id|string|目录唯一ID
files|Array\<File\>|目录内容集合
files[0].id|string|文件ID
files[0].name|string|文件名
files[0].size|number|文件大小
files[0].type|string|文件类型，目录(folder) 或 文件(file)
files[0].ctime|number|文件创建时间戳
files[0].mtime|number|文件修改时间戳
files[0].path|string|文件相对路径
files[0].download_url|string|文件下载地址


### 获取配置文件
```
GET /api/setting
```
请求参数
参数名 | 含义 | 是否必须
-|-|-
token|后台口令|是

返回结果
名称 | 类型 | 说明
-|-|-
data|object|
data.token|string|后台口令
data.title|string|网站title
data.theme|string|当前主题
data.theme_options|Array\<string\>|可用主题
data.index_enable|boolean|是否启用目录索引
data.ignores|Array\<string\>|忽略路径
data.acl_file|string|加密文件对应名称
data.webdav_path|string|WebDAV 路径
data.webdav_user|string|WebDAV 用户名
data.webdav_pass|string|WebDAV 密码
data.webdav_proxy|boolean|是否启用WebDAV代理

### 重启应用
```
PUT /api/reload?token={token}
```

### 清除缓存
```
PUT /api/cache/clear?token={token}
```


### 导出配置
```
GET /api/setting?raw=true&token={token}
```

# 主题开发
Sharelist 自定义主题存放路径为 ```cache/theme``` 目录。

# 插件开发
Sharelist 自定义插件路径存放路径为 ```cache/plugins``` 目录。

### 资源命名
sharelist使用统一的资源命名方式,即 ```protocol://key/fid```。
字段|含义
-|-
protocol|挂载协议，仅用于区分挂载类型
key|挂载标记，用于标记挂载实例
fid|资源的内部ID

### 辅助函数
插件在```onReady```时将接收```app```，```app```包含一些列辅助开发函数
函数名|用途
-|-
request|用于完成 HTTP 请求
error|抛异常
createReadStream|流读取函数
getDrives|获取挂载信息
saveDrive|保存挂载信息

### 插件功能
完整的插件应提供
方法|描述|必须功能
-|-|-
list|列目录|✓
get|获取文件信息|✓
mkdir|新建目录
rm|删除
rename|重命名
mv|移动
upload|上传


### 简单示例
```js
module.exports = class Driver {
  constructor() {
    this.name = 'TestPlugin'
    this.label = 'TestPlugin'

    //可被挂载
    this.mountable = true

    //不使用缓存
    this.cache = false

    //版本
    this.version = '1.0'

    //协议名
    this.protocol = 'test'

    //挂载需要的参数
    this.guide = [
      { key: 'path', label: '目录地址', type: 'string', required: true },
    ]
  },

  //初始化完毕，接收全局app 实例
  onReady(app){
    this.app = app
  },
  list(id){

  },
  get(id){

  },
  mkdir(parent_id,name){

  },
  rm(id){

  },
  mv(){

  }
}
```