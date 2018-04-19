# gdlist

Google Drive List


## Install
### Shell script
````bash
wget --no-check-certificate -qO- https://raw.githubusercontent.com/reruin/gdlist/master/install.sh | bash
````

### Docker support
````bash
docker build -t yourname/gdlist .

docker run -d -v /etc/gdlist:/app/config -p 33001:33001 --name="gdlist" yourname/gdlist
````

OR

````bash
docker-compose up
````

It will be available at: `http://localhost:33001`
