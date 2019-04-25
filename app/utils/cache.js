const { createFiledb } = require('./db/filedb');

const cachePath = process.cwd()+'/cache/db.json';

const db = createFiledb(cachePath);

module.exports = db