# 安装
Sharelist支持多种安装方式。

## Docker
```bash
docker run -d -v /etc/sharelist:/sharelist/cache -p 33001:33001 --name="sharelist" reruin/sharelist:next
```

## 二进制版
[release](https://github.com/reruin/sharelist/releases)下载二进制版。


## Heroku
请 Fork [sharelist-heroku](https://github.com/reruin/sharelist-heroku/tree/next)，然后在个人仓库下点 Deploy to HeroKu。


安装完成首次访问 `http://localhost:33001`地址，将进入默认界面。访问`http://localhost:33001/@manage` 进入后台管理，默认口令为 ```sharelist```。