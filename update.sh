#!/bin/bash

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

echo "+============================================================+"
echo "|                    ShareList Installer                     |"
echo "|                                                            |"
echo "|                                         <reruin@gmail.com> |"
echo "|------------------------------------------------------------|"
echo "|                                         https://reruin.net |"
echo "+============================================================+"
echo ""

echo -e "\n|  ShareList is updating ... "

# deps
if [ -n "$(command -v apt-get)" ]
then
  apt-get install -y wget unzip >/dev/null 2>&1
elif [ -n "$(command -v yum)" ]
then
  yum install -y wget unzip >/dev/null 2>&1
fi


echo -e "|\n|  Download ShareList Package ... "
wget -O sharelist-master.zip https://github.com/reruin/sharelist/archive/master.zip >/dev/null 2>&1

unzip -q -o sharelist-master.zip -d ./
rm -rf ./plugins
rm -rf ./app/plugins
cp -rf sharelist-master/* ./
rm -rf sharelist-master*

echo -e "|\n|  Install Dependents ... "
npm install >/dev/null 2>&1
pm2 restart all >/dev/null 2>&1

echo -e "|\n|  Success: ShareList has been updated\n"