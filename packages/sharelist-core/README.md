# @sharelist/core [![npm](https://img.shields.io/npm/v/@sharelist/core.svg)](https://npmjs.com/package/@sharelist/core)

It's a framework for mounting netdisk.

## Useage

```js
const sharelist = require('@sharelist/core')

const driver = sharelistCore({ config, plugins: [/* some sharelist plugins */]})

// And you can use this driver

const disk = await driver.list()

// find dir
const parentDir = disk.files.find(i => i.type == 'folder')

// mkdir
const newDir = await driver.mkdir(parentDir.id)

// rename
await driver.rename(newDir.id, {name:'new name'})

// upload
const fileData = await driver.upload(newDir.id, stream,{ name,size })

// download
try{
  const { stream } = await driver.createReadStream(fileData.id)
  stream.pipe( fs.createReadStream('./'+fileData.name))

}catch(e){

}

// remove
await driver.rm(newDir.id)


// Also you can use path locate
const disk = driver.createAction()

await disk.list('/')

// mkdir create dir named 'new_dir'  at '/'
await disk.mkdir('/new_dir',)

// rename
await disk.mv('/new_dir','/new_dir2')

// move
await disk.mv('/new_dir','/some/new_dir')

// rm
await disk.rm('/some/new_dir')

//upload
await disk.upload('/some/newfile.txt',stream)

```
