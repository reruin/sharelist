# 负载均衡
由[drive.lb.js](https://github.com/reruin/sharelist/tree/master/plugins/drive.lb.js)插件实现。用于将请求转发到多个对等的网盘。       
```
挂载路径：用;分割多个路径地址  
``` 

例如，已经在```http://localhost/a```和```http://localhost/b```路径上挂载了内容相同的两个网盘，需要将两者的请求其合并到```http://localhost/c```路径下，在后台虚拟路径处，选择LoadBalancer类型，挂载路径填写为```/a;/b```即可。 

**注意：负载目录建立后，其目标目录将被自动隐藏（管理员模式可见）。**   