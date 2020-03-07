function fileType(v) {
  if (['mp4', 'mpeg', 'wmv', 'webm', 'avi', 'rmvb', 'mov', 'mkv', 'f4v', 'flv'].includes(v)) {
    return 'video'
  } else if (['mp3', 'm4a', 'wav', 'wma', 'ape', 'flac', 'ogg'].includes(v)) {
    return 'audio'
  } else if (['doc', 'docx', 'wps'].includes(v)) {
    return 'word'
  } else if (['pdf'].includes(v)) {
    return 'pdf'
  } else if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf', 'txt', 'yaml', 'ini', 'cfg'].includes(v)) {
    return 'doc'
  } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'wmf', 'tif'].includes(v)) {
    return 'image'
  } else if (['zip', 'rar', '7z', 'tar', 'gz', 'gz2'].includes(v)) {
    return 'archive'
  } else {
    return 'other'
  }
}

function byte (v) {
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

var statusCode = {
  '413':'请求实体太大',
  '414':'请求URI太长',
  '415':'不支持的媒体类型',
}
function upload(file, opts) {
  var xhr = new XMLHttpRequest();
  var data = { type: 'upload', name: file.name, size: file.size , path : opts.path }
  xhr.open("POST", "");
  xhr.overrideMimeType("application/octet-stream");
  xhr.setRequestHeader('x-request', encodeURIComponent(JSON.stringify(data)));
  xhr.timeout = 0;
  xhr.upload.addEventListener('progress', function(e) {
    if (opts.onProgress) opts.onProgress(e)
  })

  xhr.ontimeout = function () {
    console.error('The request timed out.');
  };


  xhr.onreadystatechange = function(e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        var result;
        if(xhr.getResponseHeader('content-type').indexOf('application/json') >= 0){
          result = JSON.parse(xhr.responseText); // 必须从 responseText 读文本数据
        } else{
          result = (xhr.responseText);
        }
        if (typeof opts.onSuccess === "function") {
          opts.onSuccess(result)
        }
      }else{
        console.log( xhr.status )
        let tips = '上传失败。' + statusCode[xhr.status] || ''
        alert(tips)
      }
    }
  }

  xhr.send(file)
}



function uploadTask(files , id , isFolder , rootPath){
  var pointer = 0 ;
  
  var currentId = id + '_' + pointer

  var process = function(){
   upload(files[pointer], {
      path:isFolder ? ( files[pointer].relativePath || files[pointer].webkitRelativePath ) : files[pointer].name,
      onStart: function(data) {

      },
      onProgress: function(e) {
        if(isFolder){
          let per = Math.ceil(100 * (e.loaded / e.total)) + '%'
          $('#' + id).find('.upload-progress').css({ 'width': per })
          $('#' + id).find('.tip').html(`(上传中${pointer+1}/${files.length})`)
        }else{
          let per = Math.ceil(100 * (e.loaded / e.total)) + '%'
          $('#' + currentId).find('.upload-progress').css({ 'width': per })
          $('#' + currentId).find('.tip').html('(上传中'+per+')')
        }
      },
      onSuccess: function(data) {
        if( data && data.status != 0 ){
          alert(data.result)
        }else{
          if(!isFolder){
            $('#' + currentId).find('.upload-progress').remove()
            $('#' + currentId).find('.tip').remove()
            $('#' + currentId).removeAttr('id').attr('href',(location.pathname+'/'+files[pointer].name).replace(/\/+/g,'/'))
          }

          pointer++
          if( pointer < files.length ){
            currentId = id + '_' + pointer
            process()
          }else{
            if(isFolder){
              $('#' + id).find('.upload-progress').remove()
              $('#' + id).find('.tip').remove()
              $('#' + id).removeAttr('id').attr('href',(location.pathname+'/'+rootPath).replace(/\/+/g,'/'))
            }
          }
        }
      }
    })
  }

  process()
}

$(function() {
  $('input[type="file"]').on('change', function() {
    var el = $(this)
    var isFolder = el.attr('webkitdirectory') !== undefined || el.attr('directory')!== undefined
    var files = el[0].files
    var id = 'j_' + Date.now()
    var dirname
    if(isFolder){
      dirname = (files[0].relativePath || files[0].webkitRelativePath).split('/')[0]
      $('.list').prepend(`<li><a class="clearfix upload" target="" id="${id}"><div class="upload-progress"></div><div class="row"><span class="file-name col-md-7 col-sm-6 col-xs-8"><i class="ic ic-folder"></i><span class="tip">(等待中)</span>${dirname}</span><span class="file-size col-md-2 col-sm-2 col-xs-4 text-right">-</span><span class="file-modified col-md-3 col-sm-4 hidden-xs text-right">-</span></div></a></li>`)
    }else{
      for(var i = 0;i<files.length;i++){
        var file = files[i]
        $('.list').prepend(`<li><a class="clearfix upload" target="" id="${id}_${i}"><div class="upload-progress"></div><div class="row"><span class="file-name col-md-7 col-sm-6 col-xs-8"><i class="ic ic-${fileType(file.name.split('.').pop())}"></i><span class="tip">(等待中)</span>${file.name}</span><span class="file-size col-md-2 col-sm-2 col-xs-4 text-right">${byte(file.size)}</span><span class="file-modified col-md-3 col-sm-4 hidden-xs text-right">-</span></div></a></li>`)
      }
    }

    uploadTask(files,id,isFolder,dirname)
  })
})
