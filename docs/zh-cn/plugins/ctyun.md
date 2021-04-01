# 天翼云盘
?> 除了API挂载，其他三种情况在登录时可能遇到验证码，因此需要为sharelist配置 [验证码识别](zh-cn/configuration) 接口。

## 个人云
Cookie版，由 [drive.189cloud.js](https://github.com/reruin/sharelist/tree/master/plugins/drive.189cloud.js) 插件实现。 

```挂载路径
//用户名/初始文件夹ID?password=密码
```

建议填写```/```，ShareList将自动开启挂载向导，按指示填写用户名密码即可。  

***

## 企业云
Cookie版，由 [drive.189cloud.business.js](https://github.com/reruin/sharelist/tree/master/plugins/drive.189cloud.business.js) 插件实现。 

```挂载路径
//用户名/初始文件夹ID?password=密码 
```
建议填写```/```，ShareList将自动开启挂载向导，按指示填写用户名密码即可。    

***

## 家庭云
Cookie版，由 [drive.189cloud.home.js](https://github.com/reruin/sharelist/tree/master/plugins/drive.189cloud.home.js) 插件实现。 

填写```/```,ShareList将自动开启挂载向导，按指示填写用户名密码即可。    


***

## API挂载
```挂载路径
//应用ID/初始文件夹ID?app_secret=应用机钥&redirect_uri=回调地址&access_token=access_token   
```
建议填写```/```，ShareList将自动开启挂载向导，按指示操作即可。  

!> access_token每隔30天需手动更新一次，到期前24小时内访问对应路径时会有更新提示。   
