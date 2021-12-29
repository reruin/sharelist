#!/bin/bash

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

echo "+============================================================+"
echo "|                    ShareList(Next) NetInstaller                  |"
echo "|                                                            |"
echo "|                                         <reruin@gmail.com> |"
echo "|------------------------------------------------------------|"
echo "|                                         https://reruin.net |"
echo "+============================================================+"
echo ""

echo -e "\n|  ShareList(Next) is installing ... "


echo -e "|\n|  Download ShareList Package ... "
wget -O sharelist-master.zip https://github.com/reruin/sharelist/archive/refs/heads/master.zip >/dev/null 2>&1

unzip -q -o sharelist-master.zip -d ./

mv sharelist-master sharelist
rm -f sharelist-master.zip

cd sharelist
echo -e "|\n|  Install Dependents ... "
npm install yarn -g >/dev/null 2>&1
npm install pm2 -g >/dev/null 2>&1

yarn install >/dev/null 2>&1
yarn build-web
mkdir -p ./packages/sharelist/theme/default
mkdir -p ./packages/sharelist/plugins
cp -r ./packages/sharelist-web/dist/* ./packages/sharelist/theme/default
cp -r ./packages/sharelist-plugin/lib/* ./packages/sharelist/plugins
cd packages/sharelist

pm2 start app.js --name sharelist-next >/dev/null 2>&1
pm2 save >/dev/null 2>&1
pm2 startup >/dev/null 2>&1

echo -e "|\n|  Success: ShareList(next) has been installed\n"