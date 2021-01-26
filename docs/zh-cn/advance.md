## 目录加密
在需加密目录内新建 ```.passwd``` 文件，```type```为验证方式，```data```为验证内容。  
目前只支持用户名密码对加密（由[auth.basic](app/plugins/auth.basic.js)插件实现）。
例如：    
```yaml
type: basic 
data: 
  - user1:111111 
  - user2:aaaaaa 
``` 

```user1```用户可使用密码```111111```验证，```user2```用户可使用密码```aaaaaa```验证。请参考[example/secret_folder/.passwd](https://github.com/reruin/sharelist/tree/master/example/secret_folder/.passwd)。 

***

## 虚拟目录

在需创建虚拟目录处新建```目录名.d.ln```文件。 其内容为```挂载标识:挂载路径```。   
指向本地```/root```的虚拟目录  
```   
fs:/root 
``` 

指向GoogleDrive的某个共享文件夹虚拟目录   
```
gd:0BwfTxffUGy_GNF9KQ25Xd0xxxxxxx 
```  
系统内置了一种单文件虚拟目录系统，使用yaml构建，以```sld.ln```作为后缀保存。参考 [example/sharelist_drive.sld.ln](https://github.com/reruin/sharelist/tree/master/example/sharelist_drive.sld.ln)。 

## cf-worker中转

复制 [cf-worker](https://github.com/reruin/sharelist/tree/master/proxy/cf-worker.js) 脚本，修改```HOST```为sharelist的访问地址，```TOKEN```为管理后台的访问口令。以此为内容创建cf worker，之后将cf-worker地址(```https://**.workers.dev```) 保存到```后台配置```->```中转服务器```中。   

!> 注意，由于Cloudflare限制，```HOST```必须是使用标准端口(80,443)的域名地址，例如 ```http://example.com/```，因而你需要**为运行ShareList服务的IP做域名解析**，同时**修改其运行端口为80或443**（可在app/config.js中修改），**强烈建议使用nginx进行代理。** 

***

## sharelist-proxy中转

[Sharelist Proxy](https://github.com/linkdrive/sharelist-proxy)可支持更加自由的中转方式，支持多种安装方式。   

1. [此页面](https://github.com/linkdrive/sharelist-proxy/releases) 可下载对应版本的中转程序。以 -t [TOKEN] -h [HOST] 参数启动即可。
2. 已安装Node环境时，可直接运行 ```npx @sharelist/proxy -t [TOKEN] -h [HOST]```启动。 
3. Docker ```docker run sharelist/proxy -e t="[TOKEN]" -e h="[HOST]"```。

?> **Sharelist Proxy默认工作在33009端口，可以使用```-p [PORT]```参数指定其他端口。**   


***


## 负载均衡
ShareList支持将请求发送到多个对等的网盘，实现负载均衡。
1. 成功挂载对等网盘。
2. 新增类型为```负载均衡```的挂载源，挂载路径为对等网盘的访问路径，用```;```分割多个路径地址。

例如，已经在```http://localhost/a```和```http://localhost/b```路径上挂载了内容相同的两个网盘，需要将两者的请求其合并到```http://localhost/c```路径下，在后台虚拟路径处，选择LoadBalancer类型，挂载路径填写为```/a;/b```即可。 

!> **注意：负载目录建立后，其目标目录将被自动隐藏（管理员模式可见）。**   

***

## Zeroconf
ShareList支持向其他系统申明服务。包括： 
1. Sharelist Web站点
2. Sharelist WebDAV（Emby Zeroconf 浏览器可用）


***

## SMB(实验功能)
ShareList尝试支持将挂载内容以SMB服务形式分享，需在后台管理处启用。暂只支持SMB1.0 且为只读模式。
默认的SMB连接信息
```
端口: 8445
路径: SL
用户名: admin
密码：后台管理密码
```

***

## 主题开发

ShareList使用的pug/jade作为模板引擎，目录位于 theme 文件夹内。   
1. 至少需要实现index/detail/manage/auth/custom 5个页面，分别对应 列表/详情/管理/授权密码/自定义 页面。
2. 请直接使用**绝对地址**来引用资源(js/css)，他们会直接路由到对应到模板下。

开发请参考[默认主题](https://github.com/reruin/sharelist/tree/master/theme)。 


***

## Nginx(Caddy)反向代理
使用反代时，请添加以下配置。  

#### Nginx  
```ini 
  proxy_set_header Host  $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  proxy_set_header Range $http_range;
  proxy_set_header If-Range $http_if_range;
  proxy_no_cache $http_range $http_if_range;
```   
如果使用上传功能，请调整 nginx 上传文件大小限制。   
```
  client_max_body_size 8000m;
```   
#### Caddy   
```ini
  header_upstream Host {host}
  header_upstream X-Real-IP {remote}
  header_upstream X-Forwarded-For {remote}
  header_upstream X-Forwarded-Proto {scheme}
```