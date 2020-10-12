### 蓝奏云
由 [plugins/drive.lanzou.js](https://github.com/reruin/sharelist/tree/master/plugins/drive.lanzou.js) 插件提供对 [蓝奏云](https://www.lanzou.com/) 的访问支持，可支持蓝奏自带的文件提取码功能。   
```挂载路径  
folderId  
password@folderId
``` 
?> ```folderId```是分享链接中```bxxxxxx```部分。

支持自定路径,如：
```挂载路径  
s/aaa111
```

?> 插件为 ```mp4/jpg ```等禁止上传的格式提供解析支持，只需在文件名后附加```ct```后缀即可。以mp4为例，将```xxx.mp4```命名为```xxx.mp4.ct```后再上传，插件将自动解析为mp4文件。   