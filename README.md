# ShareList

ShareList 是一个易用的网盘工具，支持快速挂载 GoogleDrive、OneDrive ，可通过插件扩展功能。

## 目录
* [ShareList特性](#特性)  
* [功能说明](#功能说明) 
* [插件](#插件) 
  * [目录挂载类](#目录挂载类) 
  * [目录加密类](#目录加密类) 
  * [文件预览类](#文件预览类) 
  * [插件开发](#插件开发) 
* [安装](#安装) 

## 特性 
- 多种网盘系统快速挂载。 
- 支持虚拟目录和虚拟文件。 
- 支持目录加密。 
- 插件机制。 
- 国际化支持。  
- WebDAV导出。  

## 功能说明 
### 挂载对象 
首次使用时将提示选在挂载源，选择挂载源，填入对应路径即可。 
系统内置了本地路径（FileSystem）挂载源。 

### 目录加密 
在需加密目录内新建 ```.passwd``` 文件，```type```为验证方式，```data```为验证内容。例如：    
```yaml
type: basic 
data: 
  - user1:111111 
  - user2:aaaaaa 
``` 
```basic```是内置的验证方式，使用用户名密码对进行判断，上面的例子中可使用```user1```的密码为```111```，```user2```的密码为```aaaaaa```。请参考[example/SecretFolder/.passwd](example)。 

### 虚拟目录 
在需创建虚拟目录处新建```目录名.d.ln```文件。 其内容为```挂载源:挂载路径``` 
如：创建虚拟目录指向本地```/root```。 
```
fs:/root 
``` 
其中挂载源```fs```表示本地磁盘，```/root```代表路径。  

再如：创建虚拟目录指向GoogleDrive的某个共享文件夹 
```
gd:0BwfTxffUGy_GNF9KQ25Xd0xxxxxxx 
``` 
```gd```是GoogleDrive的挂载源标示，冒号后的是共享文件夹ID。   
  
### 虚拟文件 
与虚拟目录类似，目标指向具体文件。  
在需创建虚拟文件处新建```文件名.后缀名.ln```文件。 其内容为```挂载源:挂载路径```。 
如：创建一个```ubuntu_18.iso```的虚拟文件，请参考[example/linkTo_download_ubuntu_18.iso.ln](example)。 
  
### WebDAV 
系统部分支持WebDAV。可使用的功能包括列目录、展示内容、权限校验。由于系统仅做挂载用途，不支持写入、删除、重命名、复制等操作。默认根路径为```/webdav```，可在后台修改WebDAV的路径。   
注意事项：  
windows挂载webdav可读取文件最大为50M，请[参考](https://answers.microsoft.com/en-us/ie/forum/all/error-0x800700df-the-file-size-exceeds-the-limit/d208bba6-920c-4639-bd45-f345f462934f)修改 

## 插件 
插件可用于扩展挂载源、扩展加密方式、扩展文件预览。插件请置于plugins目录。 内置插件位于[app/plugins](app/plugins) 
### 目录挂载类 
#### HTTP/HTTPS（内置） 
为指向HTTP(S)的虚拟文件提供访问支持。挂载标示```http/https```，实际url作为路径。  
#### FileSystem（内置）
提供对本地文件系统的访问。挂载标示```fs```，id为 文件路径，统一使用linux的路径，例如 windows D盘 为 ```/d/```。 
#### ShareListDrive（内置）
ShareListDrive是ShareList内置的一种虚拟文件系统，使用yaml构建。以```sld```作为后缀保存。参考[example/ShareListDrive.sld](example)。 
#### BasicAuth（内置） 
提供基础文件夹加密方式。 
#### GoogleDrive 
提供对GoogleDrive的访问。挂载标示：```gd```，分享文件夹ID作为路径。 
#### OneDrive 
提供对OneDrive的访问。挂载标示```od```，分享文件夹ID作为路径。 
#### ~~OneDrive For Business~~ 
~~提供对OneDrive Business的访问。挂载标示odb，分享的url作为路径。~~ 
#### OneDrive API 
OneDrive API版挂载插件。挂载标示：```oda```。   
路径比较复杂： ```OneDrive路径->应用ID|应用机钥|回调地址|refresh_token```  
如果没有能力组织以上标示，也没关系，只需要录入```路径```，ShareList将会在首次访对应地址时，开启挂载向导，按指示操作即可。  
例如，需要挂载onedrive的 /abc/123目录，只需输入 ```/abc/123``` 即可。  

对于不符合OneDrive安全要求的域名，将采用中转方式验证，[查看中转页面](https://github.com/reruin/reruin.github.io/blob/master/redirect/onedrive.html)。  

#### WebDAV ####
用于访问WebDAV服务。使用标准WebDAV路径即可。  
例如```https://username:password@webdavserver.com:1222/path```  
若服务端不支持断点续传，请在路径后追加```acceptRanges=none```。  
例如```https://username:password@webdavserver.com:1222/?acceptRanges=none```
#### Lanzou蓝奏云 
提供对[蓝奏云](https://www.lanzou.com/)的访问支持。挂载标示lanzou，```passwd@folderId```作为路径，无密码则直接使用```folderId```作为路径。```folderId```是分享链接中```bxxxxxx```部分。   
插件为目录 以及 mp4/jpg等禁止上传的格式提供解析支持。     
文件：附加```txt```后缀即可。以mp4为例，将```xxx.mp4```命名为```xxx.mp4.txt```后再上传，插件将自动解析为mp4文件。  
目录：创建```目录名.passwd@folderId.d.txt```的文件上传即可（由于大小为 0 B的文件无法上传，请为这个txt文件随意添加些内容）。  
#### h5ai(beta)
用于访问h5ai目录程序。使用http url挂载即可。例如：     
```https://larsjung.de/h5ai/demo/```   

#### GitHub
用于访问GitHub代码库。使用有以下两种挂载方式。     
```github:username```   
```github:username/repo```   

### 目录加密类 
#### 基础加密（内置） 
使用用户名密码对进行简单判断。一个典型的加密```.passwd``` 文件的内容如下。
```yaml
type: basic 
data: 
  - user1:111111 
  - user2:aaaaaa 
``` 
此例中可使用```user1```的密码为```111```，```user2```的密码为```aaaaaa```。请参考[example/SecretFolder/.passwd](example)。 

### 文件预览类 
#### 多媒体预览
为图片、音频、视频提供在线预览。

#### Torrent预览
为种子文件提供在线预览。

### 插件开发 
待完善   

## 安装
### Shell
```bash
bash install.sh
```
Netinstall
```bash
wget --no-check-certificate -qO-  https://raw.githubusercontent.com/reruin/sharelist/master/netinstall.sh | bash
```
Update
```bash
bash update.sh
```  

### Docker support
```bash
docker build -t yourname/sharelist .

docker run -d -v /etc/sharelist:/app/cache -p 33001:33001 --name="sharelist" yourname/sharelist
```

OR

```bash
docker-compose up
```

访问 `http://localhost:33001` 
WebDAV 目录 `http://localhost:33001/webdav` 


### Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/reruin/sharelist-heroku)


