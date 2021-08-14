const createDriver = require('../')

const path = require('path')

const testdriver = () => {
  const list = (id) => {
    return {
      id: 'folder',
      files: new Array(10).fill(0).map((i) => ({
        id: 'folder' + i,
        name: 'file' + i,
        size: 0,
        type: 'folder',
        ctime: Date.now(),
        mtime: Date.now(),
      })),
    }
  }

  const get = (id) => {
    return {
      id: id,
      name: 'file' + id,
      size: 0,
      type: 'file',
      ctime: Date.now(),
      mtime: Date.now(),
    }
  }

  return { name: 'test', protocol: 'test', mountable: true, list, get }
};

(async () => {
  const driver = await createDriver({
    plugins: [testdriver]
  })

  console.log(await driver.list())
})()
