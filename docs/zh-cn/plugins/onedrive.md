# OneDrive

新版 [OneDrive V2](https://github.com/reruin/sharelist/tree/master/plugins/drive.onedrive.js) 插件提供多种方式的挂载，适用于 家庭版 和 商业版(企业版/教育版)。请将```挂载路径留空```，访问后会开启挂载向导。  

![onedrive.png](https://i.loli.net/2020/10/12/KyeB3Ot7ZDfzdqv.png)

### API挂载
```选择地区```后，前往对应的Azure管理后台```注册应用```，获取应用ID(app_id)和应用机密(app_secret)，并将```重定向URI```设置为
```https://reruin.github.io/sharelist/redirect.html```, [查看中转页的代码](https://github.com/reruin/reruin.github.io/blob/master/sharelist/redirect.html)

?> 租户ID：商业版子账户需要填写租户ID(tenant_id)，从```Azure管理后台```的```概述```里可以找到此项。。  

***

### 分享链接挂载
在OneDrive创建分享，获取分享链接一般是这样的：   
```https://xxxx.sharepoint.com/:f:/g/personal/xxxxxxxx/mmmmmmmmm?e=XXXX```   

***

### 自动挂载
与API挂载类似，但使用ShareList内置的一组app_id和app_secert。优点是不需要注册应用。
