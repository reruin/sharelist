## 目录加密
在需加密目录内新建 ```.passwd``` 文件（此项可修改），```type```为验证方式，```data```为验证内容。  
例如：    
```yaml
type: basic
data:
  - 123456
  - abcdef
``` 

可使用密码```123456```，```abcdef```验证。

***

## 获取文件夹ID
保持后台登录状态，回到首页列表，点击文件夹后的 '!' 按钮 可查看文件夹ID。   

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