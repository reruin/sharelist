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

echo -e "\n|   ShareList is installing ... "

# deps
if [ -n "$(command -v apt-get)" ]
then
  apt-get install -y curl >/dev/null 2>&1
  curl -sL https://deb.nodesource.com/setup_8.x | bash - >/dev/null 2>&1
  apt-get install -y nodejs >/dev/null 2>&1
elif [ -n "$(command -v yum)" ]
then
  yum install -y curl >/dev/null 2>&1
  curl --silent --location https://rpm.nodesource.com/setup_8.x | bash - >/dev/null 2>&1
  yum install -y nodejs >/dev/null 2>&1
fi

npm install
npm install pm2 -g

pm2 start app.js --name sharelist --env prod
pm2 save
pm2 startup

echo -e "|\n|   Success: ShareList has been installed\n|"