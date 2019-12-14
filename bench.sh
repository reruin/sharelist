#!/bin/bash
#==============================================================#
#   Description: Bensh Shell                                   #
#   Author: reruin <reruin@gmail.com>                          #
#   Intro:  https://fansh.org                                  #
#==============================================================#

PATH=/bin:/sbin:/usr/bin:/usr/sbin:/usr/local/bin:/usr/local/sbin:~/bin
export PATH

version="2017.06.23"

# 移除前后空格
function prep ()
{
  echo "$1" | sed -e 's/^ *//g' -e 's/ *$//g' | sed -n '1 p'
}


# Base64 values
function base ()
{
  echo "$1" | tr -d '\n' | base64 | tr -d '=' | tr -d '\n' | sed 's/\//%2F/g' | sed 's/\+/%2B/g'
}

function save ()
{
  #echo "$1:$2"
  local sp=','
  if [ "$savespan" = 'O' -o "$savespan" = 'A' ]; then
    sp=''
  fi
  # clear
  if [ "$1" = 'S' ] ;then
    data="$data$sp\"$2\""
  elif [ "$1" = 'SS' ] ;then
    data="$data$sp$2"
  elif [ "$1" = 'P' ] ;then
    data="$data$sp\"$2\":\"$3\""
  elif [ "$1" = 'PS' ] ;then
    data="$data$sp\"$2\":$3"
  # link object
  elif [ "$1" = 'O' ] ;then
    data="$data$sp\"$2\":{"
  elif [ "$1" = 'OE' ] ;then
    data="$data}"

  # link array
  elif [ "$1" = 'A' ] ;then
    data="$data$sp\"$2\":["
  elif [ "$1" = 'AE' ] ;then
    data="$data]"
  fi
  savespan="$1"
}

function save2 ()
{
  echo "$1:$2"
  if [ "$1" = 'L' ] ;then
    localdata=''
  elif [ "$2" = 'LO' ] ;then
    data="$data,\"$1\":{$localdata}"

  elif [ "$2" = 'LA' ] ;then
    data="$data,\"$1\":[$localdata]"

  elif [ "$2" = 'LY' ] ;then
    if [ "$localdata" = "" ] ;then
      localdata="$2"
    else
      localdata="$localdata,$2"
    fi
  elif [ ! -n "$3" ] ;then
    data="$data,\"$1\":\"$2\""
  elif [ "$3" = "L" ] ;then
    if [ "$localdata" = "" ] ;then
      localdata="\"$1\":\"$2\""
    else
      localdata="$localdata,\"$1\":\"$2\""
    fi
  else
    data="$data,\"$1\":$2"
    localdata=''
  fi  
}
# Integer values
function int ()
{
  echo ${1/\.*}
}

# Filter numeric
function num ()
{
  case $1 in
      ''|*[!0-9\.]*) echo 0 
    ;;
      *) echo $1 
    ;;
  esac
}

function trace ()
{
  echo ""
  echo "$1"
}

function dl ()
{
  local speedtest=$(wget -4O /dev/null -T300 $1 2>&1 | awk '/\/dev\/null/ {speed=$3 $4} END {gsub(/\(|\)/,"",speed); print speed}')

    local domain=$(awk -F'/' '{print $3}' <<< $1)

    #ipaddress=$(ping -c 1 $domain | grep from | awk '{print $4}' | sed 's/://')
    local ipaddress=$(ping -c 1 $domain | grep PING | awk -F'[)(]' '{print $2}')

    local dlstr="{\"title\":\"$2\",\"ip\":\"$ipaddress\",\"speed\":\"$speedtest\"}"

    save 'SS' "$dlstr"
}

function speed_dl ()
{
  save 'O' 'download_speed'
  speed_v4
  save 'OE'
}

function speed_v4 ()
{

  save 'A' 'v4'

    dl 'http://cachefly.cachefly.net/100mb.test' 'CacheFly'
    dl 'http://speedtest.tokyo.linode.com/100MB-tokyo.bin' 'Linode, Tokyo, JP'
    # dl 'http://speedtest.singapore.linode.com/100MB-singapore.bin' 'Linode, Singapore, SG'
    # dl 'http://speedtest.london.linode.com/100MB-london.bin' 'Linode, London, UK'
    # dl 'http://speedtest.frankfurt.linode.com/100MB-frankfurt.bin' 'Linode, Frankfurt, DE'
    # dl 'http://speedtest.fremont.linode.com/100MB-fremont.bin' 'Linode, Fremont, CA'
    # dl 'http://speedtest.dal05.softlayer.com/downloads/test100.zip' 'Softlayer, Dallas, TX'
    # dl 'http://speedtest.sea01.softlayer.com/downloads/test100.zip' 'Softlayer, Seattle, WA'
    # dl 'http://speedtest.fra02.softlayer.com/downloads/test100.zip' 'Softlayer, Frankfurt, DE'
    # dl 'http://speedtest.sng01.softlayer.com/downloads/test100.zip' 'Softlayer, Singapore, SG'
    # dl 'http://speedtest.hkg02.softlayer.com/downloads/test100.zip' 'Softlayer, HongKong, CN'

    save 'AE'
}

function prepare ()
{
  trace "========== 正在准备 请稍后 =========="

  local os_arch="x64"
  case $(uname -m) in
    x86_64)
      os_arch="x64"
      ;;
    i*86)
      os_arch="x86"
      ;;
    *)
      os_arch=$(uname -m)
      ;;
  esac

  apt-get -y -q install python wget curl >/dev/null 2>&1

  root_path="/root/.bench"
  mkdir -p "$root_path"
  # prepare
  local tool_url="https://raw.githubusercontent.com/reruin/bench/master/utils/besttrace_${os_arch}"
  local speedtest_url="https://raw.githubusercontent.com/sivel/speedtest-cli/master/speedtest.py"
  local server_url="https://raw.githubusercontent.com/reruin/bench/master/utils/node"
  if ! wget --no-check-certificate $tool_url -O "$root_path/besttrace" >/dev/null 2>&1; then
        echo "Failed to download trace tools!"
        exit 1
    fi
    chmod +x $root_path/besttrace

    if ! wget --no-check-certificate $speedtest_url -O "$root_path/speedtest-cli.py" >/dev/null 2>&1; then
        echo "Failed to download speedtest-cli tools!"
        exit 1
    fi

    if ! wget --no-check-certificate $server_url -O "$root_path/node" >/dev/null 2>&1; then
        echo "Failed to download server nodes!"
        exit 1
    fi

    echo ""
}

function io_test()
{
    (LANG=en_US dd if=/dev/zero of=test_$$ bs=64k count=16k conv=fdatasync && rm -f test_$$ ) 2>&1 | awk -F, '{io=$NF} END { print io}' | sed 's/^[ \t]*//;s/[ \t]*$//'
}

# 去程路由
function trin ()
{
  local mtrurl="http://www.ipip.net/traceroute.php?as=1&a=get&n=1&id=$1&ip=$ipv4"
  local mtrraw=$(curl -s $mtrurl | grep -Po '(?<=parent\.resp_once\().*?(?=\)<\/)' | sed -r 's/<[^>]*>//g' | sed -r "s/'([0-9]+)',/\"hop\":\"\1\",\"data\":/g" | sed -r 's/<[^>]*>//g' | sed -e ':a;$!N;s/\n/},{/;ta')

    local mtrstr="{\"title\":\"$2\",\"data\":[{$mtrraw}]}"

    save 'SS' "$mtrstr"
}

# 回程路由
function trout ()
{
  local mtrraw=$($root_path/besttrace -J -q 2 $1 | grep data | sed -e ':a;$!N;s/\n/,/;ta')
  
  save 'SS' "{\"title\":\"$2\",\"ip\":\"$1\",\"data\":[$mtrraw]}"
}


# 去程延迟
function pingin ()
{
    echo "===测试去程延迟==="

  local pingurl="www.ipip.net/ping.php?a=send&host=$ipv4&area%5B%5D=china"
  #local pingstr=$(curl -s $mtrurl | grep -Po '(?<=parent\.call_ping\().*?(?=\);<\/)' | sed -e ':a;$!N;s/\n/,/;ta')
  local pingstr=$(curl -s $pingurl)

  local pingdetail=$(echo "$pingstr" | grep -Po '(?<=parent\.call_ping\().*?(?=\);<\/)'  | sed -r 's/,"(text|link_name|link_url)":"[^"]*"//g' | sed  -e ':a;$!N;s/\n/,/;ta')

  local pingsummary=$(echo "$pingstr" | grep -Po '(?<=parent\.summary_ping\(\{).*?(?=}\)<\/)' | sed -r 's/("[^"]+?"):(\{[^}]*\})/\{"title":\1,"data":\2\}/g')
  
  save 'O' 'in'
  save 'PS' 'detail' "[$pingdetail]"
  save 'PS' 'summary' "[$pingsummary]"
  save 'OE'
}

# 回程延迟
function pingout ()
{
    echo "===测试回程延迟==="

  local pt=''

  while read la
  do
    local line=$(echo "$la" | tr -d "^M")
    local cur=($line) 

      local praw=$( echo "$line" | awk '{print "-c 4 -w 4 "$2}' | xargs ping | grep -e '1 ttl' -e loss -e rtt | sed -e 's/ttl=/|/g' -e 's/transmitted, /|/g')
    local ttl=$(echo "$praw" | grep icmp_seq | cut -d '|' -f 2 | awk '{print $1}')
    local lose=$(echo "$praw" | grep loss | cut -d '|' -f 2 | awk '{print 100-25*$1}')
    local rtt=$(echo "$praw" | grep rtt | awk -F '[ /]' '{ print "\"rtt_min\":"$7",\"rtt_avg\":"$8",\"rtt_max\":"$9",\"rtt_mdev\":"$10 }')

    local pstr="\"lose\":$lose"

    if [ "$ttl" = "" ]; then
        pstr="$pstr,\"ttl\":\"N/A\""
      else
        pstr="$pstr,\"ttl\":$ttl"
      fi

    if [ "$rtt" = "" ]; then
        pstr="$pstr,\"rtt_min\":0,\"rtt_avg\":0,\"rtt_max\":0,\"rtt_mdev\":0"
      else
        pstr="$pstr,$rtt"
      fi

      pstr="\"id\":\"${cur[0]}\",\"ip\":\"${cur[1]}\",\"name\":\"${cur[2]}\",\"area\":\"${cur[3]}\",\"isp\":\"${cur[4]}\",$pstr"

    if [ "$pt" = "" ]; then
        pt="{$pstr}"
      else
        pt="$pt,{$pstr}"
      fi

  done < $root_path/node
  
  save 'O' 'out'
  save 'PS' 'detail' "[$pt]"
  save 'OE'
}

function pingtest ()
{
  save 'O' 'ping'

  pingin

    pingout

  save 'OE'

}

function traceroute ()
{
  echo "===测试去程路由==="

  save 'O' 'mtr'

  save 'A' 'in'

  #101.227.255.45
  trin "100" "上海电信(天翼云)"

  #113.141.67.254
  #trin "145" "陕西西安电信(天翼云)"

  #182.150.2.2
  #trin "304" "四川成都电信(天翼云)"

  #103.24.228.1
  #trin "7" "天津联通"

  #113.207.32.97  
  #trin "12" "重庆联通"

  #101.227.255.45
  #trin "356" "上海移动"

  #202.205.6.30
  #trin "160" "北京教育网"

  save 'AE'

  echo "===测试回程路由==="

  save 'A' 'out' 

    # trout "101.227.255.45" "上海电信(天翼云)"

    # trout "113.141.67.254" "陕西西安电信(天翼云)"

    # trout "182.150.2.3" "四川成都电信(天翼云)"

    # trout "103.24.228.1" "天津联通"

    # trout "113.207.32.97" "重庆联通"

    # trout "183.192.160.3" "上海移动"

    # trout "202.205.6.30" "北京教育网"

  save 'AE'

  save 'OE'
}

function system ()
{

  echo "========== 1. 基础信息 =========="

  data="\"version\":\"$version\""

  save 'P' "timestamp" $(prep $(int "$(date +%s)"))

  save 'O' 'systeminfo'
  save 'P' "uptime" $(prep $(int "$(cat /proc/uptime | awk '{ print $1 }')"))
  save 'P' "ram" $( free -m | awk '/Mem/ {print $2}' ) 'L'
  save 'P' "swap" $( free -m | awk '/Swap/ {print $2}' ) 'L'
  save 'P' "disk" $(prep $(num "$(($(df -P -B 1 | grep '^/' | awk '{ print $2 }' | sed -e :a -e '$!N;s/\n/+/;ta')))")) 'L'
  
  cpu
  os

  save 'OE'
}


function io ()
{
  echo "========== 2. IO性能测试 =========="

  local io1=$( io_test )
  local io2=$( io_test )
  local io3=$( io_test )
  local ioraw1=$( echo $io1 | awk 'NR==1 {print $1}' )
  [ "`echo $io1 | awk 'NR==1 {print $2}'`" == "GB/s" ] && ioraw1=$( awk 'BEGIN{print '$ioraw1' * 1024}' )
  local ioraw2=$( echo $io2 | awk 'NR==1 {print $1}' )
  [ "`echo $io2 | awk 'NR==1 {print $2}'`" == "GB/s" ] && ioraw2=$( awk 'BEGIN{print '$ioraw2' * 1024}' )
  local ioraw3=$( echo $io3 | awk 'NR==1 {print $1}' )
  [ "`echo $io3 | awk 'NR==1 {print $2}'`" == "GB/s" ] && ioraw3=$( awk 'BEGIN{print '$ioraw3' * 1024}' )
  local ioall=$( awk 'BEGIN{print '$ioraw1' + '$ioraw1' + '$ioraw1'}' )
  local ioavg=$( awk 'BEGIN{print '$ioall'/3}' )

  save 'PS' 'io' "{\"detail\":[$ioraw1,$ioraw1,$ioraw1],\"avg\":$ioavg,\"unit\":\"MB/s\"}"
}

function os ()
{
  os_kernel=$(prep "$(uname -r)")

  if ls /etc/*release > /dev/null 2>&1
  then
    os_name=$(prep "$(cat /etc/*release | grep '^PRETTY_NAME=\|^NAME=\|^DISTRIB_ID=' | awk -F\= '{ print $2 }' | tr -d '"' | tac)")
  fi

  if [ -z "$os_name" ]
  then
    if [ -e /etc/redhat-release ]
    then
      os_name=$(prep "$(cat /etc/redhat-release)")
    elif [ -e /etc/debian_version ]
    then
      os_name=$(prep "Debian $(cat /etc/debian_version)")
    fi

    if [ -z "$os_name" ]
    then
      os_name=$(prep "$(uname -s)")
    fi
  fi

  case $(uname -m) in
    x86_64)
      os_arch="x64"
      ;;
    i*86)
      os_arch="x86"
      ;;
    *)
      os_arch=$(uname -m)
      ;;
  esac

  save 'P' "os_kernel" "$os_kernel"

  save 'P' "os_name"   "$os_name"

  save 'P' "os_arch"   "$os_arch"
}

function cpu ()
{
  # CPU details
  cpu_name=$(prep "$(cat /proc/cpuinfo | grep 'model name' | awk -F\: '{ print $2 }')")
  cpu_cores=$(prep "$(($(cat /proc/cpuinfo | grep 'model name' | awk -F\: '{ print $2 }' | sed -e :a -e '$!N;s/\n/\|/;ta' | tr -cd \| | wc -c)+1))")

  if [ -z "$cpu_name" ]
  then
    cpu_name=$(prep "$(cat /proc/cpuinfo | grep 'vendor_id' | awk -F\: '{ print $2 } END { if (!NR) print "N/A" }')")
    cpu_cores=$(prep "$(($(cat /proc/cpuinfo | grep 'vendor_id' | awk -F\: '{ print $2 }' | sed -e :a -e '$!N;s/\n/\|/;ta' | tr -cd \| | wc -c)+1))")
  fi

  cpu_freq=$(prep "$(cat /proc/cpuinfo | grep 'cpu MHz' | awk -F\: '{ print $2 }')")

  if [ -z "$cpu_freq" ]
  then
    cpu_freq=$(prep $(num "$(lscpu | grep 'CPU MHz' | awk -F\: '{ print $2 }' | sed -e 's/^ *//g' -e 's/ *$//g')"))
  fi

  save 'P' "cpu_name"  "$cpu_name"
  save 'P' "cpu_cores" "$cpu_cores"
  save 'P' "cpu_freq"  "$cpu_freq"
}

function network ()
{
  trace "========== 3. 网络测试 =========="

  save 'O' 'network'

  # IP addresses and network usage
  #ipv4=$(prep "$(ip addr show $nic | grep 'inet ' | awk '{ print $2 }' | awk -F\/ '{ print $1 }' | grep -v '^127' | awk '{ print $0 } END { if (!NR) print "N/A" }')")
  ipv4=$(curl -s myip.ipip.net | awk -F ' ' '{print $2}' | awk -F '：' '{print $2}')
  ipv6=$(prep "$(ip addr show $nic | grep 'inet6 ' | awk '{ print $2 }' | awk -F\/ '{ print $1 }' | grep -v '^::' | grep -v '^0000:' | grep -v '^fe80:' | awk '{ print $0 } END { if (!NR) print "N/A" }')")

  save 'P' "nic" $(prep "$(ip route get 8.8.8.8 | grep dev | awk -F'dev' '{ print $2 }' | awk '{ print $1 }')")

  save 'P' 'ipv4' "$ipv4"
  save 'P' 'location' "$(curl -s myip.ipip.net | awk -F '：' '{print $3}')"

  save 'P' "ipv6" "$ipv6"

  trace "========== 3.1 网络带宽测试 =========="
  save 'PS' "bandwidth" "$(python $root_path/speedtest-cli.py --share --json)"

  trace "========== 3.2 网络下载测试 =========="
  #speed_dl

  trace "========== 3.3 Ping延迟测试 =========="
  #pingtest

  trace "========== 3.4 路由测试 =========="
  traceroute


  save 'OE'
}

function update_debug ()
{
  data="{$data}"
  trace "========== 测试完成 =========="
  echo ''
  echo ''
  echo ''
  echo ''
  echo "$data"

}

function update ()
{
  # 发送数据
  if [ -n "$(command -v timeout)" ]
  then
    timeout -s SIGKILL 30 wget -q -o /dev/null -O ./bench.log -T 25 --post-data "$data" --no-check-certificate "https://tinyapi.sinaapp.com/serverwatch/"
  else
    wget -q -o /dev/null -O ./bench.log -T 25 --post-data "$data" --no-check-certificate "https://tinyapi.sinaapp.com/serverwatch/"
    wget_pid=$!
    wget_counter=0
    wget_timeout=30

    while kill -0 "$wget_pid" && (( wget_counter < wget_timeout ))
    do
        sleep 1
        (( wget_counter++ ))
    done

    kill -0 "$wget_pid" && kill -s SIGKILL "$wget_pid"
  fi
}

function main ()
{
  prepare
  system
  #io
  network
  update_debug
}

main

exit 1