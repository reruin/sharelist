# ShareList

在线挂载 GoogleDrive、OneDrive 的简易工具，可通过插件扩展功能。

## 特性
- 通过插件支持多种网盘系统。可通过自定义插件提供更多的类型支持
插件请置于plugins目录，自动启用。  
- 支持目录嵌套
- 加密目录  
在文件夹内新建 ```.密码.passwd``` 命名的文件即可，例如 
```.123456.passwd```  
不要省略最前方的```.``` 
- 国际化支持 
- 即将支持WebDAV 

## 已内置插件 
### GoogleDrive 
提供对GoogleDrive的访问。协议名 gd，id为 分享文件夹ID
### OneDrive 
提供对OneDrive的访问。协议名 od，id为 分享文件夹ID 
### OneDrive For Business
提供对OneDrive Business的访问。协议名 odb，id为 分享的url 
### HTTP(S) 
提供对HTTP链接的访问。协议名 http，id为 uri 
### LocalFileSystem
提供对本地文件系统的访问。协议名 fd，id为 文件路径，统一使用linux的路径，例如 windows D盘 为 ```/d/```。 
### ShareListDrive
ShareListDrive是ShareList内置的一种虚拟文件系统，使用yaml构建。以```xd```作为后缀保存。参考 ```example/download.xd```。 
### Ln(快捷方式)
提供一种快捷方式的实现。只需要新建类似 ```名称.类型后缀.ln``` 的文件，文件内容为```协议:id``` 即可。 
特别的，文件夹将使用```d```这个预设类型后缀。 
例子：  
1. 重定向到 某个http链接对应的文件 参考  ```example/http_download_ubuntu_18.iso.ln```  
2. 重定向到 GoogleDrive的某个目录 参考 ```example/GoogleDrive.d.ln```  
3. 重定向到 本地上级目录 参考 ```example/parent_folder.d.ln``` 


## 插件开发 
待补充 

## 已知BUG 
1. GoogleDrive插件：目录内文件过多时无法完全显示，也无法分页。 


## 安装
### Shell
````bash
bash install.sh
````

### Docker support
````bash
docker build -t yourname/sharelist .

docker run -d -v /etc/sharelist:/app/cache -p 33001:33001 --name="sharelist" yourname/sharelist
````

OR

````bash
docker-compose up
````

访问 `http://localhost:33001` 


### Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/reruin/sharelist-heroku)



