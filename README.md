# ShareList

在线挂载 GoogleDrive、OneDrive 的简易工具 ， 只需提供分享文件夹ID。

## 特性
1. 文件夹ID挂载网盘
2. 支持虚拟目录
在网盘内以如下格式重命名文件夹
格式：```显示名称.文件夹id.类型```
类型支持 od(OneDrive) gd(GoogleDrive)

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



