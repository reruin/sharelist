# 安装
Sharelist支持多种安装方式。

## 脚本安装
脚本安装适合不熟悉NodeJs的用户。    

执行命令后将自动安装NodeJs环境，并在当前目录（执行命令的目录）安装sharelist。

```bash
wget --no-check-certificate -qO-  https://raw.githubusercontent.com/reruin/sharelist/master/netinstall.sh | bash
```

访问 `http://localhost:33001` 即可进入
WebDAV 目录 `http://localhost:33001/webdav` 

?> sharelist自带更新脚本，在sharelist目录内执行 ```update.sh```即可自动更新。

!> Sharelist需要NodeJS运行环境(>=8.0)，一些早期的发行版可能无法被支持。此脚本不支持Windows。

## 手动安装
如果已有NodeJs环境，或者需要在windows下安装，可选择手动安装。

将[项目仓库](https://github.com/reruin/sharelist)克隆到本地，进入项目目录执行:   
```bash
npm install
npm install pm2 -g

pm2 start app.js --name sharelist --env prod
pm2 save
pm2 startup
```

更新
```bash
bash update.sh
```  

## Docker
```bash
docker run -d -v /etc/sharelist:/sharelist/cache -p 33001:33001 --name="sharelist" reruin/sharelist
```


## Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/reruin/sharelist-heroku)

## Kubesail

[![Deploy](https://img.shields.io/badge/deploy%20to-kubesail-blue?style=for-the-badge)](https://kubesail.com/template/reruin/sharelist)