# ShareList

在线挂载 GoogleDrive、OneDrive 的简易工具 ， 只需提供分享文件夹ID。

## 安装
### Shell script
````bash
wget --no-check-certificate -qO- https://raw.githubusercontent.com/reruin/gdlist/master/install.sh | bash
````

### Docker support
````bash
docker build -t yourname/gdlist .

docker run -d -v /etc/gdlist:/app/config -p 33001:33001 --name="gdlist" yourname/gdlist
````

OR

````bash
docker-compose up
````

访问 `http://localhost:33001` 


