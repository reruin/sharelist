#!/bin/bash

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

echo "+============================================================+"
echo "|                       GDList Installer                     |"
echo "|                                                            |"
echo "|                                         <reruin@gmail.com> |"
echo "|------------------------------------------------------------|"
echo "|                                         https://reruin.net |"
echo "+============================================================+"
echo ""

echo -e "\n|   GDList is installing ... "

# deps
if [ -n "$(command -v apt-get)" ]
then
  apt-get -y install curl unzip >/dev/null 2>&1
  curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash - >/dev/null 2>&1
  apt-get install -y nodejs >/dev/null 2>&1
elif [ -n "$(command -v yum)" ]
then
  yum -y install curl unzip >/dev/null 2>&1
  curl --silent --location https://rpm.nodesource.com/setup_8.x | sudo bash - >/dev/null 2>&1
  yum -y install nodejs >/dev/null 2>&1
fi

wget https://github.com/reruin/gdlist/archive/master.zip -O gdlist.zip
unzip gdlist
cd gdlist-master
npm install yarn -g
yarn pm2 -g
pm2 start bin/www
pm2 save
pm2 startup

echo -e "|\n|   Success: The GDList has been installed\n|"