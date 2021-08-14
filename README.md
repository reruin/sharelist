# ShareList

[![Build Status](https://github.com/reruin/sharelist/actions/workflows/ci.yml/badge.svg?branch=next)](https://github.com/reruin/sharelist/actions/workflows/ci.yml)

ShareList 是一个易用的网盘工具，支持快速挂载 GoogleDrive、OneDrive ，可通过插件扩展功能。  
新版正在开发中，欢迎[提交反馈](https://github.com/reruin/sharelist/issues/new/choose)。

[查看旧版](https://github.com/reruin/sharelist/tree/0.1)

## 安装
```docker
docker run -d -v /etc/sharelist:/sharelist/cache -p 33001:33001 --name="sharelist" reruin/sharelist:next
```

[release](https://github.com/reruin/sharelist/releases)下载二进制版。


## 许可
[MIT](https://opensource.org/licenses/MIT)   
Copyright (c) 2018-present, Reruin
