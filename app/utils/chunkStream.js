const { Writable, Readable } = require('stream')
const fs = require('fs')
const os = require('os')
const { promisify } = require("util");
const Stream = require('stream')
const readline = require('readline');

const [open, close, read, write, unlink, ftruncate] = [
  promisify(fs.open),
  promisify(fs.close),
  promisify(fs.read),
  promisify(fs.write),
  promisify(fs.unlink),
  promisify(fs.ftruncate)
];

class FileCacheStream extends Readable {
  /**
   *
   * @param {number} [size ] 分片大小
   * @param {number} [total] 文件大小
   *
   */
  constructor(size , total) {
    super()
        //缓存区
    this.filePath = os.tmpdir() + '/sharelist/' + Date.now()
    this.fd = fs.openSync(this.filePath, 'w+')
    this.readTotal = 0
    this.writeTotal = 0
    this.size = size
    this.total = total
    this.readUnitOffset = 0
    this.writeUnitOffset = 0

    if( size > total){
      this.size = total
    }
    // 在第一个字节流出之前
    this._enableWrite = false

    this._needReadable = false
    
  }

  /**
   *
   * 只读流 read 实现
   *
   */
  _read(size = 1) {
    //log('write '+this.writeUnitOffset+', read '+this.readUnitOffset + '/' + this.readTotal)
    //process.stdout.write('write '+this.writeUnitOffset+', read '+this.readUnitOffset + '/' + this.readTotal);
    //整体读取完毕时 结束此流
    if (this.readTotal >= this.total) {
      console.log( 'readableStream END' )
      this.push(null)
    } else {
      const ret = Buffer.alloc(size)
      this._enableWrite = true

      this._needReadable = false

      //读取的字节数 大于 剩余文件的字节数
      if( size > this.size - this.readUnitOffset ){
        size = this.size - this.readUnitOffset
      }

      if(size > 0){
        fs.read(this.fd, ret, 0, size, this.readUnitOffset, (err, bytesRead) => {
          if(err) console.log('***error',this.fd,this.readUnitOffset,err)

          //if(this.retry) console.log('read' , this.readTotal,'+',this.readUnitOffset)

          this.push(ret.slice(0, bytesRead));

          this.readTotal += bytesRead
          this.readUnitOffset += bytesRead

          // let remain = this.readTotal % (1024*1024) 
          // if(Math.abs(remain) < 1024) console.log(this.readTotal/1024/1024 + 'MB')
          //console.log(self.writeTotal)
        });
      }else{
        console.log(this.readTotal , '/',this.writeTotal,'<<<')

        this._needReadable = true
      }

    }
  }


  /**
   * 写入数据
   * @param {buffer} [size ] 数据
   * @param {function} [callback] 写入完毕回调
   *
   */
  append(chunk , callback){
    // let newlen = this.writeUnitOffset + chunk.length
    // if( newlen > this.size ){
    //   this.overflowBuffer = chunk.slice(newlen - this.size)
    //   chunk = chunk.slice(0,newlen - this.size)
    // }
    //log('write '+this.writeUnitOffset)
    fs.write(this.fd, chunk, 0, null, this.writeUnitOffset ,(err , bytesWritten) => {
      if( err ){
        console.log(err)
        //重试
        this.append(chunk , callback)
      }else{
        this.writeUnitOffset += bytesWritten
        this.writeTotal += bytesWritten

        if(chunk.length !== bytesWritten) console.log('!!!!!!!!!!!!!!!!',chunk.length , bytesWritten)

        if( bytesWritten == 0 ) console.log('已到文件末尾')
        // write success
        if( this._needReadable ){
          this._read()
        }
        callback()
      }

    })
  }

  /**
   * 关闭
   */
  async close(){
    this.destroy()

    await close(this.fd)
    await unlink(this.filePath)

    this.ended = true
  }


  /**
   * 重置缓存
   * @param {boolean} [flag] 只重置只读流的起始位置
   */
  async reset(flag){
    // console.log('reset')
    if( flag === true ){
      this.readTotal -= this.readUnitOffset
      this.readUnitOffset = 0
    }else{
      //清空文件
      console.log(this.readTotal , '/',this.writeTotal,'  <-- clear')

      await ftruncate(this.fd,0)

      this.writeUnitOffset = 0
      this.readUnitOffset = 0
      // if(this.overflowBuffer){
      //   this.append(this.overflowBuffer , () => {
      //     this.overflowBuffer = null
      //   })
      // }
    }

  }
}


/**
 * ChunkStream class.
 * 分片上传类
 */

class ChunkStream extends Writable {

  /**
   *
   * @param {object} [writableStream] 目标流
   * @param {object} [options] 配置项
   * @param {number} [options.size ] 分片大小
   * @param {number} [options.total] 文件大小
   *
   */

  constructor(writableStream, options = {}) {
    super()

    this.writableStream = writableStream
    this.launchUnitMark = options.chunkSize || 10 * 1024 * 1024

    this.writeTotal = 0
    this.total = options.size
    this.writeUnitTotal = 0
    //readableStream.pause()

    this.file = new FileCacheStream(this.launchUnitMark , this.total)

    this._bind()

  }

  _bind() {

    this.writableStream.on('retry', (res) => {
      console.log('retry now write pointer:',this.file.writeUnitOffset)
      this.emit('retry',res)
    })

    this.writableStream.on('fail', (res) => {
      this.file.close()
      this.destroy(new Error(res))
    })

    this.writableStream.on('finish', async (res) => {
      let offset = this.writeTotal - this.writeTotal % this.launchUnitMark
      this.file.unpipe(this.writableStream)
      await this.file.reset()
      this.emit('update', offset, res)
    })

    this.file.pipe(this.writableStream)

    this.file.resume()

  }

  /**
   * 重传分片
   */
  retry(stream) {
    console.log('retry')
    this.file.retry = 1
    this.file.unpipe()

    this.file.reset(true)

    this.writableStream = stream

    //this.writeUnitTotal = 0

    this._bind()

  }

  /**
   * 接收下一个分片
   */
  async next(stream) {
    this.writableStream = stream

    this.writeUnitTotal = 0

    this._bind()

    //重新开始接受数据写入
    //this.emit('drain')

    if(this.remainBuffer){
      this._write(this.remainBuffer,'binary',() => {})
      this.remainBuffer = null
    }

    if(this.remainHandler){
      this.remainHandler()
      this.remainHandler = null
    }
  }

  async finish(resp){
    console.log('finish')
    await this.file.close()
    this.emit('_final')
  }

  /**
   * 可写流 writev 实现
   */
  _writev(chunks, callback) {
    console.log('writev',chunks.reduce((t,c)=>(t + c.chunk.length) , 0))
    return this._write(Buffer.concat(chunks.map(({chunk}) => chunk)),'binary',callback)
  }

  /**
   * 可写流 write 实现
   */
  _write(chunk, encoding, callback) {

    let chunkSize = chunk.length

    if(chunkSize == 0) {
      callback()
      return
    }

    // 块未满时

    if( this.writeUnitTotal < this.launchUnitMark ){

      let emptySize = this.launchUnitMark - this.writeUnitTotal

      let realWriteSize = this.writeUnitTotal + chunkSize
      let isFull = realWriteSize > this.launchUnitMark
      //写入大小 超过 分块大小
      if( chunkSize > emptySize ){

        this.remainBuffer = chunk.slice(emptySize)

        chunk = chunk.slice(0,emptySize)
        // remain 975, chunk 975， chunksize 65536
        // remain size 10469376 16384 16384 65536 false
        console.log(
          'remain size',this.remainBuffer.length , chunk.length)
      }

      this.file.append(chunk, () => {
        // console.log('write',this.writeTotal)

        this.writeTotal += chunk.length
        this.writeUnitTotal += chunk.length

        //分块未满时
        if(this.writeUnitTotal < this.launchUnitMark) {
          callback()
        }else{
          // console.log('write block full' , this.file.readTotal , this.file.writeTotal)
          this.remainHandler = callback
        }
      })
    }else{
      this.remainBuffer = chunk
      this.remainHandler = callback

      console.log('can not write',this.file.enableWrite , chunkSize > 0 , this.writeUnitTotal < this.launchUnitMark)
    }

  }

  /**
   * 可写流 final 实现
   */
  //需等待 下游读取 完毕后，再执行finish因而写入流可能
  _final(callback){
    this.on('_final' , callback)
  }
}


module.exports = function(target, options) {
  return new ChunkStream(target, options)
}
