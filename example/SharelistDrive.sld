-
  name: os
  children:
    - 
      name: linux
      children:
        -
          name: ubuntu
          children:
            -
              name: ubuntu-18.04.1-desktop-amd64.iso 
              url: http://releases.ubuntu.com/18.04.1/ubuntu-18.04.1-desktop-amd64.iso
            -
              name: ubuntu-18.04.1-live-server-amd64.iso
              url: http://releases.ubuntu.com/18.04.1/ubuntu-18.04.1-live-server-amd64.iso
            -
              name: ubuntu-16.04.5-server-amd64.iso
              url: http://releases.ubuntu.com/16.04.5/ubuntu-16.04.5-server-amd64.iso
            -
              name: ubuntu-16.04.5-desktop-amd64.iso
              url: http://releases.ubuntu.com/16.04.5/ubuntu-16.04.5-desktop-amd64.iso
        -
          name: debian
          children:
            -
              name: debian-9.5.0-amd64-DVD-1.iso
              url: https://cdimage.debian.org/debian-cd/current/amd64/iso-dvd/debian-9.5.0-amd64-DVD-1.iso
            -
              name: debian-8.11.0-amd64-DVD-1.iso
              url: https://cdimage.debian.org/cdimage/archive/8.11.0/amd64/iso-dvd/debian-8.11.0-amd64-DVD-1.iso
-
  name: mssql
  children:
    -
      name: SQL SERVER 2008R2 EXPRESS.exe
      url: https://download.microsoft.com/download/9/4/8/948966AB-52CA-40F1-8051-0216481065E6/SQLEXPRWT_x64_CHS.exe
    -
      name: SQL SERVER 2012 EXPRESS.exe
      url: https://download.microsoft.com/download/A/4/3/A43F9D8D-5346-441A-ABAE-86C3AFE17B4D/SQLEXPRWT_x64_CHS.exe
    -
      name: SQL SERVER 2017 EXPRESS.exe
      url: https://download.microsoft.com/download/5/E/9/5E9B18CC-8FD5-467E-B5BF-BADE39C51F73/SQLServer2017-SSEI-Expr.exe
-
  name: 嵌套GoodleDrive虚拟目录@0B0vQvfdCBUFjdnRpVnZsWmlFanM.gd
-
  name: 嵌套windows本地D盘.d.ln
  content: ld:/d/a.b
-
  name: 嵌套linux root目录.d.ln
  content: ld:/root