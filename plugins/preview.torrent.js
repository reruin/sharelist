/*
 * 种子文件在线播放插件
 */
//magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent

const name = 'torrentParse'

const version = '1.0'

module.exports = ({request}) => {
  const decodeUrl = (req) => {
    return req.origin + req.path + ( req.querystring ? '?' + req.querystring.replace(/preview&?/,'') : '')
  }
  const torrent = async (data , req)=>{
    return {
      ...data,
      body:`
        <script src="https://cdn.bootcss.com/webtorrent/0.103.4/webtorrent.min.js"></script>
        <script src="https://cdn.bootcss.com/jquery/3.4.1/jquery.min.js"></script>
        <script src="https://cdn.bootcss.com/jquery-treetable/3.2.0/jquery.treetable.min.js"></script>
        <link href="https://cdn.bootcss.com/jquery-treetable/3.2.0/css/jquery.treetable.min.css" rel="stylesheet">
        <link href="https://cdn.bootcss.com/jquery-treetable/3.2.0/css/jquery.treetable.theme.default.min.css" rel="stylesheet">
        <style>
        @-webkit-keyframes spin {
            100% {
                -webkit-transform: rotate(360deg)
            }
        }

        @keyframes spin {
            100% {
                -webkit-transform: rotate(360deg);
                transform: rotate(360deg)
            }
        }
          table{
            font-size:12px;
            border:none !important;
          }
          table th,table td{
            text-align:left;
            color:rgba(0,0,0,.65);
            padding:12px 0 !important;
            font-size:13px;
          }
          table a{
            font-size:12px;
          }

          #preview_container{
            position:relative;
          }

          .preview_torrent{
            position:relative;
          }

          .torrent_content{
            position:absolute;
            top:0;
            left:0;
            margin:auto;
            display:none;
            min-width: 90%;
            min-height: 60vh;
          }
          .torrent_content_close{
            position:absolute;
            top:0;
            right:0;
            line-height:32px;
            width:32px;
            height:32px;
            text-align:center;
            background:rgba(0,0,0,.15);
            color:#fff;
            cursor: pointer;
          }

          .loading {
            position: relative;
            min-height:300px;
          }

          .loading:after
          {
            content: " ";
            position: absolute
          }

          .loading:after {
            top: 50%;
            left: 50%;
            margin: -22px 0 0 -22px;
            width: 40px;
            height: 40px;
            border: 2px solid transparent;
            border-top-color: #1e88e5;
            border-left-color: #1e88e5;
            z-index: 1002;
            border-radius: 100%;
            -webkit-animation: spin .5s linear infinite;
            animation: spin .5s linear infinite
          }

          .loading:before {
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            z-index: 1001;
            background: rgba(255, 255, 255, .6)
          }
          #j_load{
            display:none;
          }
          #preview_container{
            background:#000;
            width:100%;
            height:100%;
          }
          #preview_container .loading{
            position:absolute;
            color:#fff;
          }
          #preview_container>*{
            width:100%;
            height:100%;
          }
        </style>
        <script>
          var currentTorrent;
          var currentFile;
          var client;
          var trackerslist = [
            "wss://tracker.openwebtorrent.com",
            "http://tracker3.itzmx.com:6961/announce",
            "http://tracker1.itzmx.com:8080/announce"
          ];
          function renderList(data){
            const html = createTree(data).map(i => {
              let canUse = i.file && /\.(mp4|mp3|jpg|png|gif|aac|ogg)/.test(i.id)
              return "<tr data-tt-parent-id='"+i.parentId+"' data-tt-id='"+i.id+"'><td><span>"+i.name+"</span></td><td>"+i.size+"</td><td>"+(canUse ? "<a data-id='"+i.id+"' class='preview'>预览</a>" : "")+"</td></tr>"
            })

            return "<table><tbody>"+html.join('')+"</tbody></table>"
          }

          const flatten = arr => arr.reduce((prev,item) => prev.concat( item || [] , Array.isArray(item.children) && item.children.length ? flatten(item.children) : [] ),[]);

          const map = (data, key , value) => {
            var obj = {};
            data.forEach(i => {
              if (key in i) {
                obj[i[key]] = value ? i[value] : i;
              }
            })
            return obj;
          }

          const tree = (data, fieldId = 'id', parentId = 'parentId' , children = 'children', rootId = 0) => {
            let obj = map(data, fieldId),
              root = []

            for(let i of data){
              let pid = i[parentId],id = i[fieldId]
              if (pid == rootId) {
                root.push(i)
              } else {
                if (obj[pid]) {
                  if (!obj[pid][children]) {
                    obj[pid][children] = []
                  }
                  obj[pid][children].push(i)
                }
              }
            }

            //查找root
            if(root.length == 0){
              for(let i in obj){
                if(!obj[obj[i].parentId]){
                  root.push( obj[i] )
                }
              }
            }

            return root
          }

          const byte = (v) => {
            if(v === undefined || v === null || isNaN(v)){
              return '-'
            }

            let lo = 0
            
            while(v >= 1024){
              v /= 1024
              lo++
            }
            return Math.floor(v * 100) / 100 + ' ' + ['B','KB','MB','GB','TB','PB','EB'][lo]
          }

          function createTree(data){
            const newdata = {};
            for(let i of data){
              let t = i.path.split('/');
              i.parentId = t.slice(0,-1).join('/');
              i.id = i.path;
              i.size = byte(i.length);
              i.file = 1;
              newdata[i.id] = i;

              for(var j = 0;j<t.length-1;j++){
                var id = t.slice(0,j+1).join('/');
                if(!newdata[id]){
                  newdata[id] = {id:id , parentId:t.slice(0,j).join('/'), size:'', name:t[j]};
                }
              }
            }
            let a = tree(Object.values(newdata));
            return flatten(a);
          }

          function open(id){
            if( currentTorrent && currentTorrent.files){
              let file = currentTorrent.files.find(i => i.path == id);
              if( file ){
                currentFile = id;
                file.select();
                $('#preview_container').empty()
                //.html($('#j_load').clone().html('').removeAttr('id').show());
                $('.torrent_content').fadeIn();
                file.appendTo($('#preview_container')[0]);
              }
            }
          }

          function close(){
            if( currentTorrent && currentTorrent.files && currentFile){
              let file = currentTorrent.files.find(i => i.path == currentFile);
              if( file ){
                currentFile = null
                file.deselect()
                $('#preview_container').empty()
                $('.torrent_content').fadeOut();
              }
            }
          }

          function add(torrentId){
            console.log('add ==='+torrentId+'===')
            client.add(torrentId,{announce:trackerslist} ,function (torrent) {
              load(false)
              currentTorrent = torrent;
              torrent.files.forEach(file => {
                file.deselect()
              })

              $('#torrent_list').html( renderList(torrent.files) ).find('table').treetable({expandable: true});
            })
          }

          function start(){
            if (WebTorrent.WEBRTC_SUPPORT) {
              client = new WebTorrent()
              var torrentId = '${decodeUrl(req)}'

              if(torrentId.endsWith('.magnet')){
                load('正在解析磁力链接...');
                $.get(torrentId , function(resp){
                  let hash = (resp.match(/btih:([a-z0-9]+)/) || ['',''])[1]
                  add(resp);
                })
              }else{
                add(torrentId)
              }
             
            } else {
              // Use a fallback
            }
          }

          function load(v){
            if(v === false){
              $('#j_load').empty().fadeOut()
            }else{
              $('#j_load').fadeIn().html(v)
              console.log($('#j_load'),'>>',v)
            }
          }
          
        </script>
        <div class="preview_torrent">
          <div id="torrent_list"></div>
          <div id="j_load" class="loading"></div>
          <div class="torrent_content">
            <div id="preview_container"></div>
            <div class="torrent_content_close">x</div>
          </div>
          <script>
            $('body').on('click','a.preview',function(){
              let id = $(this).attr('data-id')
              open(id)
            })

            $('body').on('click','.torrent_content_close',function(){
              close()
            })
            start()
          </script>
        </div>
      `
    }
  }

  const magnet = async (data , req) => {
    return await torrent(data , req)
  }

  const preview = { torrent , magnet}

  return { name , version , preview }
}