# ShareList

在线挂载 GoogleDrive、OneDrive 的简易工具 ， 只需提供分享文件夹ID。

## 特性
1. 支持使用GD,OD文件夹ID挂载网盘 
2. 支持列出本地目录 
统一使用linux的路径，例如 windows D盘 为 ```/d/``` 
3. 自定义文件目录
可使用yaml构建目录内容，保存为```目录名.xd```。参考 ```example/download.xd```。 
4. 支持虚拟目录嵌套
以如下格式重命名文件夹  
格式：```显示名称.文件夹id.类型```  
类型支持 od(OneDrive) gd(GoogleDrive) 
5. 加密目录  
在文件夹内新建 ```.密码.passwd``` 命名的文件即可，例如 
```.123456.passwd```  
不要省略最前方的```.```


## 已知BUG 
1. GoogleDrive目录内文件过多时无法完全显示，也无法分页。 


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



