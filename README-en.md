# ShareList

[![Build Status](https://api.travis-ci.com/reruin/sharelist.svg?branch=master)](https://travis-ci.com/reruin/sharelist)


ShareList is an easy-to-use netdisk tool which supports that quickly mount GoogleDrive and OneDrive, and extends functions with plugins.


## Contents

* [Introduction](#introduction)

* [Installation](#installation)

* [Example](#example)  

  * [Mount GoogleDrive](#mount-googledrive)

  * [Mount OneDrive (21Vianet Suppoted)](#mount-onedrive)

  * [Mount 189Cloud Netdisk (Supports for mounting with account and password)](#mount-189cloud-netdisk)

  * [Mount Local Files](#mount-local-files)

  * [Mount GitHub](#mount-github)

  * [Mount Lanzou Yun](#mount-lanzou-yun)

  * [Mount h5ai](#mount-h5ai)

  * [Mount WebDAV](#mount-webdav)

  * [Virtual Path](#virtual-path)

  * [Virtual Files](#virtual-files)

  * [Directory Encryption](#directory-encryption)

  * [Transit](#transit)

  * [Customized Transit](#customized-transit)

  * [Ignoring File Extension](#ignore-file-extension)

  * [File Preview](#file-preview)

  * [Display README](#display-readme)

  * [Load Balancer](#load-balancer)

  * [Upload File/Directory](#upload-filedirectory)

  * [WebDAV Export](#webdav-export)

  * [Expiration of Download Link](#expiration-of-download-link)

  * [Nginx/Caddy Reverse Proxy](#nginxcaddy-reverse-proxy)

* [Plug-ins development](#plug-ins-development)



## Introduction

- Quickly mount various netdisks.

- Support virtual directories and virtual files.

- Support directory encryption.

- Plug-in mechanism.

- Internationalization support. 

- WebDAV export. 



## Example

### Mount GoogleDrive

#### 1. Mount with shared ID

Implemented by [plugins/drive.gd.js](drive.gd) plugin. 

```
Mounting mark: gd
Mounting content: shared file ID

```

#### 2. Mount by the official API

Implemented by [plugins/drive.gd.api.js](drive.gd.api) plugin.

```
Mounting mark: gda 
Mounting content: 
  //application ID/root?client_secret='client_secret'&redirect_uri='redirect_uri'&refresh_token='refresh_token' 
  /  
```

It is recommended to fill in ```/```, ShareList will automatically start the mounting wizard, just follow the instructions. 

***



### Mount OneDrive

#### 1. Mount with shared ID

Implemented by [plugins/drive.od.js](plugins/drive.od.js) plugin. 

```
Mounting mark: od 
Mounting content: shared file ID.
```

**Note: Up to 30 results are displayed in a single folder.** 

#### 2. Mount with the official API

Implemented by [plugins/drive.od.api.js](plugins/drive.od.api.js) plugin.  

```
Mounting mark: oda
Mounting content:  
    OneDrive path->app_id|app_secret|redirect_uri|refresh_token
    OneDrive path
    /
```

It is recommended to fill in ```/```, ShareList will automatically start the mounting wizard, just follow the instructions. 

For domain names that do not meet OneDrive's security requirements, the transfer method will be used for verification. [View transfer page](https://github.com/reruin/reruin.github.io/blob/master/redirect/onedrive.html) 

**Note: Due to onedrive's revised policy, personal Microsoft accounts can no longer be bound through the wizard.**
**You need to go to [Azure Background Management](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) to register the application and get `app_id` and `app_secret`** 

#### 3. Mount Onedrive(21Vianet) with the official API

Implemented by [plugins/drive.odc.api.js](plugins/drive.odc.api.js) plugin.

```
Mounting mark: odc
Mounting content:  
    //app_id/path?client_secret='client_secret'&redirect_uri='redirect_uri'&refresh_token='refresh_token'&tenant='organization name'
    /
```

It is recommended to fill in ```/```, ShareList will automatically start the mounting wizard, just follow the instructions. 

**Note: The organization name refers to the part shown in the ```https://***-my.sharepoint.cn/``` asterisk in the web disk access link.** 

#### 4. Mount OneDrive For Business

Implemented by [plugins/drive.odb.js](plugins/drive.odb.js) plugin. 

```
Mounting mark: odb 
Mounting content: shared url
```

**Note: Up to 30 results will be displayed in a single folder.** 

***

 
### Mount 189Cloud Netdisk

#### 1. Mount 189Cloud Netdisk with account password (Cookie method)

Implemented by [drive.189cloud.js](app/plugins/drive.189cloud.js) plugin. 

```
Mounting mark: ctcc
Mounting content: 
    //username/'initial folderID'?password='password'
    /
```

It is recommended to fill in ```/```, ShareList will automatically start the mount wizard, and follow the instructions to fill in the username and password. 

#### 2. Mount 189Cloud Netdisk with API

Implemented by [drive.189cloud.api.js](app/plugins/drive.189cloud.api.js) plugin. 

```
Mounting mark: ctc
Mounting content:  
    //app_id/'initial folderID'?app_secret='app_secret'&redirect_uri='redirect_uri'&access_token='access_token'  
    /
```

It is recommended to fill in ```/```, ShareList will automatically start the mounting wizard, just follow the instructions. 

**Note: The access_token needs to be updated manually every 30 days, and there will be an update prompt when accessing the corresponding path within 24 hours before the expiration.**  

***

 

### Mount Local Files

Implemented by [drive.fs.js](app/plugins/drive.fs.js) plugin. 

```
Mounting indication: fs  
Mounting content: file path.
```

**Note: Unix-style paths are used uniformly, for example, D drive in Windows is ```/d/```.**  

***

 

### Mount GitHub

Implemented by [plugins/drive.github.js](plugins/drive.github.js) plugin. Used to access the GitHub code base. There are the following two mounting methods.   

```
Mounting mark: github  
Mounting content:
  username  
  username/repo
``` 

**Note: The method is only for browsing, does not support git operations such as ```git clone```.** 

***

 

### Mount LanZou Yun

Implemented by [plugins/drive.lanzou.js](plugins/drive.lanzou.js) plugin. Provide access which supports for [LanZou Yun](https://www.lanzou.com/).  

```
Mounting mark: lanzou
Mount path: 
  folderId
  password@folderId
```

**Note: ```folderId``` is the```bxxxxxx``` part of the sharing link.** 

The plug-in provides parsing support for formats that are prohibited to upload, such as ```mp4/jpg```, just append the suffix ```txt``` to the file name. Take mp4 as an example, name```xxx.mp4``` as``` xxx.mp4.txt``` and upload it again, the plugin will automatically parse into mp4 file.

***

 

### Mount h5ai

Implemented by the [drive.h5ai.js](plugins/drive.h5ai.js) plug-in, used to access the h5ai directory program. 

```
Mounting indication: h5ai  
Mounting path: http address
```

For example: ```h5ai:https://larsjung.de/h5ai/demo/```

***

 

### Mount WebDAV

Implemented by [drive.webdav.js](plugins/drive.webdav.js) plugin, used to access WebDAV services. 

```
Mounting mark: webdav 
Mounting path: 
  https://webdavserver.com:1222/path  
  https://username:password@webdavserver.com:1222/path
  https://username:password@webdavserver.com:1222/?acceptRanges=none
```

**Note: If the server does not support resuming of the breakpoint, you need to add ```acceptRanges=none```**

***

 

### Virtual Path

Create a new ```directory name.d.ln``` file where the virtual directory needs to be created. Its content is ```Mounting ID:Mounting path```. 

Point to the local ```/root``` virtual directory.

```
fs:/root
```

Point to a virtual directory of a shared folder on GoogleDrive  

```
gd:0BwfTxffUGy_GNF9KQ25Xd0xxxxxxx
```

The system has a built-in single file virtual directory system, built using yaml, and saved with ```sld``` as a suffix. Refer to [example/ShareListDrive.sld](example/sharelist_drive.sld).

***



### Virtual Files

Similar to a virtual directory, the target points to a specific file. 

Create a new file ```".filename.suffix.ln"``` where the virtual file needs to be created. Its content is ```Mounting ID: Mounting path```.

For example: to create a virtual file of `ubuntu_18.iso`, please refer to [example/linkTo_download_ubuntu_18.iso.ln](example/linkTo_download_ubuntu_18.iso.ln).

***

 

### Directory Encryption

Create a new ```.passwd``` file in the directory to be encrypted,``` type``` is the verification method, and ```data``` is the verification content. 

Currently only supports username and password encryption (implemented by [auth.basic](app/plugins/auth.basic.js) plugin).

E.g:   

```yaml
type: basic
data:
  -user1: 111111
  -user2: aaaaaa
```

```user1``` user can use password```111111``` to verify, ```user2``` user can use password```aaaaaa``` to verify. Please refer to [example/secret_folder/.passwd](example/secret_folder/.passwd).

***

 

### Transit

In `Background management -> General settings`, set ```transfer (including preview)``` to enable to achieve transfer agent. ```transit path``` can enable transit for the specified path (including sub-paths), leaving blank means it is valid for all paths.

**Note that due to functional limitations, the following mounting methods will force the use of transit mode:**  
**```OneDrive For Business(Mounted by ID), GoogleDriveAPI, GoogleDrive(Mounted by ID) ```**

***



### Customized Transit

When the proxy mode is enabled, you can set the proxy server in `Background management -> General settings`. After setting, all download requests will be transferred through this server, and currently support [cf-worker](proxy/cf-worker.js).    

#### 1. CF-Worker

Copy the script from [proxy/cf-worker.js](proxy/cf-worker.js), modify ```HOST``` as the access address of sharelist, and```TOKEN``` as the access password of the Background Managerment. Create a cf-worker with this content, and then save the cf-worker address (```https://**.workers.dev```) to the sharelist background.  

**Note that due to Cloudflare restrictions, ```HOST``` must be a domain name address using a standard port (80,443), such as``` http://example.com / ```, so you need to make a A(AAAA) record in DNS for sharelist IP , and changes its running port to 80 or 443 (can be modified in app/config.js). It is strongly recommended to use nginx as a proxy.**

***



### Load Balancer

Implemented by [drive.lb.js](app/plugins/drive.lb.js) plugin. Used to forward requests to multiple peer network drives.      

```
Mounting mark: lb
Mounting path: 
  Use ; to split multiple path addresses 
```

For example, two network drives with the same content have been mounted on the paths ```http://localhost/a``` and```http://localhost/b```. It is merged into the path of ```http://localhost/c```, and at the virtual path in the background, select the load balancer type, and fill in the mounting path as`/a;/b`

**Note: After the load directory is created, its target directory will be automatically hidden (visible in administrator mode).**  

***



### Ignore File Extension

In `Background management -> General settings`, ```Ignore File Extensions``` can define the file types to be ignored. For example, ignore the picture: ```jpg, png, gif, webp, bmp, jpeg```. 



### Display README

In `Background management -> General settings`, set ```Display README content``` to enable, when the current directory contains ```README.md```, it will be automatically displayed on the page.

***
 

### File Preview

In `Background management -> General settings`, set ```Preview``` to enable to preview specific files.  

 

#### Document

Implemented by [preview.document](plugins/drive.document.js) plugin, you can preview file type such as md, word, ppt, excel.



#### Multimedia

Implemented by [preview.media](plugins/drive.media.js) plugin, you can preview pictures, audio and video. 

In `Background management -> Plug-in Settings`, ```Video Previewable Formats``` can be defined to preview the video type. 

 

#### Torrent 

Implemented by [preview.torrent](plugins/drive.torrent.js) plugin, you can preview online preview for torrent files. 

***
 

### Upload File/Directory

In the login status (the upload button will appear at the top of the page), you can upload files/directories to the local drive(fs), OneDriveAPI(oda), and GoogleDriveAPI(gda). 

It is currently in an experimental stage, and various types of anomalies may occur.   
  
  
  
### WebDAV Export
The mount source can be transferred out in WebDAV mode, and currently supports list and download functions.
The webDAV path can be set in the `Background management -> General settings`. 

 

### Expiration of Download Link

In `Background management -> General settings`, after setting ```Download Link Max Age```, the download link will be expiration within this time period. 
To turn off this feature, set to 0.    

***
 

### Nginx/Caddy Reverse Proxy

While using reverse proxy, please add the following configuration. 

Nginx  

```ini
  proxy_set_header Host  $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  proxy_set_header Range $http_range;
  proxy_set_header If-Range $http_if_range;
  proxy_no_cache $http_range $http_if_range;
```  

If you need to use the upload feature, please adjust the nginx upload file size limit.  

```
  client_max_body_size 8000m;
```  

Caddy  

```ini
  header_upstream Host {host}
  header_upstream X-Real-IP {remote}
  header_upstream X-Forwarded-For {remote}
  header_upstream X-Forwarded-Proto {scheme}

```

 


## Plug-ins development

To be continued




## Installation

### Shell
Install

```bash
bash install.sh
```

Remote install/Netinstall

```bash
wget --no-check-certificate -qO- https://raw.githubusercontent.com/reruin/sharelist/master/netinstall.sh | bash
```

Update 

```bash
bash update.sh
``` 

 

### Docker support
Install

```bash
docker build -t yourname/sharelist .

docker run -d -v /etc/sharelist:/app/cache -p 33001:33001 --name="sharelist" yourname/sharelist
```
OR
```bash
docker-compose up
```

Update

```bash
docker pull reruin/sharelist:latest
``` 

Visit `http://localhost:33001`

WebDAV directory `http://localhost:33001/webdav`

 

### Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/reruin/sharelist-heroku)

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/reruin/sharelist)