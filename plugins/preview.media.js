/*
 * video/audio/image 在线预览插件
 */

const qs = require('querystring')

const name = 'mediaParse'

const version = '1.1'

module.exports = ({getSource , getPluginOption , setPluginOption , getConfig}) => {

  const preview = {};
  let videoFormatKey = 'video_previewable_formats'
  let videoPlayerKey = 'video_previewable_player'

  let videoFormatOption = getPluginOption(videoFormatKey) || {};
  let videoPlayerOption = getPluginOption(videoPlayerKey) || {};
  let videoFormat = 'mp4,ogg,webm,mpeg,m4v'
  let videoPlayer = 'default'

  if( videoFormatOption.value ){
    videoFormat = videoFormatOption.value
    videoPlayer = videoPlayerOption.value
  }else{
    setPluginOption(videoFormatKey,{value:videoFormat , label:'支持预览的视频后缀','placeholder':'文件扩展名，多个用逗号分隔'})
  }

  if( videoPlayerOption.value ){
    videoPlayer = videoPlayerOption.value
  }else{
    setPluginOption(videoPlayerKey,{value:videoPlayer , label:'视频预览播放器',options:[{'label':'默认','value':'default'},{'label':'DPlayer','value':'dplayer'}]})
  }

  const convUrl = (req) => {
    let query = req.query || {}
    delete query.preview
    let querystr = qs.stringify(query)
    return req.path + ( querystr ? ('?' + querystr) : '')
  }

  const video = async (data , req) => {
    let videoPlayer = (getPluginOption(videoPlayerKey) || {value:'default'}).value;
    let proxyMode = getConfig('proxy_enable') == 1
    return {
      ...data,
      // body:`
      //   <video src="${req.path}" style="min-width: 90%;min-height: 60vh;" controls="controls" autoplay="autoplay"></video>
      // `,
       body: videoPlayer == 'dplayer' ? `
        <script src="https://cdn.bootcdn.net/ajax/libs/flv.js/1.5.0/flv.min.js"></script>
        <script src="https://cdn.bootcss.com/dplayer/1.25.1/DPlayer.min.js"></script>
        <div id="dplayer" style="height:100%;"></div>
        <script>
          var url = '${convUrl(req)}' , subtitle = url.replace(/\\.[^\\.]+?(\\?|$)/,'.vtt$1');
          var type=(url.split('?')[0].split(".").pop() == "flv") ? 'flv' : 'auto';
          var options = {
            container: document.getElementById('dplayer'),
            video:{
              url: url,
              type: type
            },
          }
          if(${proxyMode}) options.subtitle = {
            url: subtitle,
            fontSize: '25px',
            bottom: '7%',
          }
          var dp = new DPlayer(options);
        </script>
      ` : `
        <iframe></iframe><script>var content='<style>video{width:100%;height:100%;background:#000;}body{margin:0;padding:0;}</style><video src="${convUrl(req)}" controls="controls" autoplay="autoplay"></video>';document.querySelector("iframe").contentWindow.document.write(content);</script>
      `
    }
  }

  const audio = async (data , req) => {
    return {
      ...data,
      body:`
        <iframe></iframe><script>document.querySelector("iframe").contentWindow.document.write('<audio src="${convUrl(req)}" controls="controls" autoplay="autoplay" />')</script>
      `
    }
  }

  const image = async (data , req) => {
    return {
      ...data,
      body:`
        <img src="${convUrl(req)}" />
      `
    }
  }

  const hls = async (data , req) => {
    return {
      ...data,
       body: `
        <script src="https://cdn.bootcss.com/hls.js/8.0.0-beta.3/hls.min.js"></script>
        <script src="https://cdn.bootcss.com/dplayer/1.25.1/DPlayer.min.js"></script>
        <div id="dplayer" style="margin-top:32px;height:60vh;"></div>
        <script>
          var url = '${convUrl(req)}';
          var dp = new DPlayer({
            container: document.getElementById('dplayer'),
            video:{
              url: url,
              type:'hls'
            },
            
          });
        </script>
      `
    }
  }


  videoFormat.split(',').forEach( ext => {
    preview[ext] = video
  });
  
  ['m3u8'].forEach( ext => {
    preview[ext] = hls
  });

  ['mp3','m4a','acc'].forEach( ext => {
    preview[ext] = audio
  });

  ['jpg','jpeg','png','gif','bmp'].forEach( ext => {
    preview[ext] = image
  });

  return { name , version , preview }
}