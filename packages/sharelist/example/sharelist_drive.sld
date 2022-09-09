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
              name: ubuntu-22.04.1-desktop-amd64.iso
              size: 3826831360
              url: http://releases.ubuntu.com/jammy/ubuntu-22.04.1-desktop-amd64.iso
            -
              name: ubuntu-20.04.4-desktop-amd64.iso
              size: 3379068928
              url: http://releases.ubuntu.com/focal/ubuntu-20.04.4-desktop-amd64.iso
            -
              name: ubuntu-18.04.6-desktop-amd64.iso 
              size: 2514124800
              url: http://releases.ubuntu.com/bionic/ubuntu-18.04.6-desktop-amd64.iso
        -
          name: debian
          children:
            -
              name: debian-11.4.0-amd64-DVD-1.iso
              size: 3901456384
              url: https://cdimage.debian.org/debian-cd/11.4.0/amd64/iso-dvd/debian-11.4.0-amd64-DVD-1.iso
            -
              name: debian-10.12.0-amd64-netinst.iso
              size: 352321536
              url: https://cdimage.debian.org/cdimage/archive/10.12.0/amd64/iso-cd/debian-10.12.0-amd64-netinst.iso
            -
              name: debian-9.13.0-amd64-netinst.iso
              size: 306184192
              url: https://cdimage.debian.org/cdimage/archive/9.13.0/amd64/iso-cd/debian-9.13.0-amd64-netinst.iso
-
  name: mssql
  children:
    -
      name: SQL SERVER 2008R2 EXPRESS.exe
      size: 393058248
      url: https://download.microsoft.com/download/9/4/8/948966AB-52CA-40F1-8051-0216481065E6/SQLEXPRWT_x64_CHS.exe
    -
      name: SQL SERVER 2012 EXPRESS.exe
      size: 1233880504
      url: https://download.microsoft.com/download/A/4/3/A43F9D8D-5346-441A-ABAE-86C3AFE17B4D/SQLEXPRWT_x64_CHS.exe
    -
      name: SQLServer2017-SSEI-Expr.exe
      size: 5744056
      url: https://download.microsoft.com/download/5/E/9/5E9B18CC-8FD5-467E-B5BF-BADE39C51F73/SQLServer2017-SSEI-Expr.exe