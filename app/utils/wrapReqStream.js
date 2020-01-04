const { Readable } = require('stream')

class wrapReqStream extends Readable {
  constructor(target , options = {}) {
    //默认缓冲区 64KB
    options.highWaterMark = options.highWaterMark || 64 * 1024
    super(options);
    this.target = target

    //默认发送单元大小
    this.launchUnitMark = options.launchUnitMark || 16 * 1024
    this.buffers = [];// 缓冲区
    this.length = 0;//缓存区的总长度

    this.size = options.size
    this.isEnd = false

    this.needReadable = false

    this.target.on('data' , (chunk)=>{
      let bytesRead = chunk.length
      this.length += bytesRead
      
      if(bytesRead > 0){
        this.buffers.push(chunk.slice(0));
        if(this.needReadable){
          this._read()
        }
      }
    })

    this.target.on('end' , () => {
      this.isEnd = true
    })

    this.target.pause()
  }

  isTargetPaused(){
    return this.target.isPaused()
  }
  _read() {
    if( this.length <= 0 && this.isEnd ){
      this.push(null)
      return 
    }

    let n = this.launchUnitMark

    if( this.isEnd && n >= this.length ) n = this.length
    
    //console.log('read',n,', cache block length =',this.buffers.length,',cache length =',this.length,',readableLength :',this.readableLength,',is end :',this.isEnd)

    this.needReadable = false

    //read 值小于缓冲区
    if( n > 0 && n <= this.length ){
      let ret = Buffer.alloc(n);
      let b;
      let index = 0;
      let flag = false
      while (null != (b = this.buffers.shift())) {
        for (let i = 0; i < b.length; i++) {
          ret[index++] = b[i];
          if (index == ret.length) {//填充完毕
            this.length -= n;
            b = b.slice(i + 1);
            this.buffers.unshift(b);
            flag = true
            break;
          }
        }
        if( flag ) break;
      }

      let r = this.push(ret)
      //read缓冲区已满,暂停 从 target 读取,否则恢复 target 读取
      if(r == false){
        if(this.isTargetPaused() == false) {
          this.target.pause()
        }
      }
      else{
        if( this.isTargetPaused() ){
          this.target.resume()
        }
      }
    }
    
    //target缓存不足
    else{
      this.needReadable = true
      //target 暂停时 重新启动
      if( this.isTargetPaused() ){
        this.target.resume()
      }
    }

  }
}

module.exports = function(target , options){
  return new wrapReqStream(target , options)
}