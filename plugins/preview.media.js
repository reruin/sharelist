/*
 * video/audio/image 在线预览插件
 */
const name = 'mediaParse'

const version = '1.0'

module.exports = ({getSource}) => {

  const video = async (data , req) => {
    return {
      ...data,
      body:`
        <iframe src="javascript:'<style>video{width:100%;height:100%;background:#000;}body{margin:0;padding:0;}</style><video src=\""+${req.path}+"\" controls=\"controls\" autoplay=\"autoplay\"></video>'"></iframe>
      `
    }
  }

  const audio = async (data , req) => {
    return {
      ...data,
      body:`
        <audio src="${req.path}" controls="controls" autoplay="autoplay" />
      `
    }
  }

  const image = async (data , req) => {
    return {
      ...data,
      body:`
        <img src="${req.path}" />
      `
    }
  }


  const preview = {};

  ['mp4','ogg','webm','mpeg','m4v'].forEach( ext => {
    preview[ext] = video
  });

  ['mp3','m4a','acc'].forEach( ext => {
    preview[ext] = audio
  });

  ['jpg','jpeg','png','gif','bmp'].forEach( ext => {
    preview[ext] = image
  });

  return { name , version , preview }
}