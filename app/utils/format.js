const { isString , isDate } = require('./base')

const datetime = (date, expr = 'iso') => {
  var a = new Date()
  if(isDate(date)){
    a = date
  }
  else if(isString(date)){
    try{
      a = new Date(date);
    }catch(e){

    }
  }

  var y = a.getFullYear(),
    M = a.getMonth() + 1,
    d = a.getDate(),
    D = a.getDay(),
    h = a.getHours(),
    m = a.getMinutes(),
    s = a.getSeconds();

  function zeroize(v) {
    v = parseInt(v);
    return v < 10 ? "0" + v : v;
  }

  if(expr === 'iso'){
    return a.toISOString()
  }
  return expr.replace(/(?:s{1,2}|m{1,2}|h{1,2}|d{1,2}|M{1,4}|y{1,4})/g, function(str) {

    switch (str) {
      case 's':
        return s;
      case 'ss':
        return zeroize(s);
      case 'm':
        return m;
      case 'mm':
        return zeroize(m);
      case 'h':
        return h;
      case 'hh':
        return zeroize(h);
      case 'd':
        return d;
      case 'dd':
        return zeroize(d);
      case 'M':
        return M;
      case 'MM':
        return zeroize(M);
      case 'MMMM':
        return ['十二', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一'][m] + '月';
      case 'yy':
        return String(y).substr(2);
      case 'yyyy':
        return y;
      default:
        return str.substr(1, str.length - 2);
    }
  });
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

const byteMap = {'B':1,'KB':1e3,'MB':1e6,'GB':1e9,'TB':1e12,'PB':1e15,'EB':1e18}
const retrieveByte = (v) => {
  if(/[\d\.]+\s*(B|KB|MB|GB|TB|PB|EB|K|M|G|T|P|E)/.test(v)){
    let num = parseFloat(v)
    let unit = (v.match(/(B|KB|MB|GB|TB|PB|EB|K|M|G|T|P|E)/) || [''])[0]

    if(unit && num){
      if(!unit.endsWith('B')) unit += 'B'
      return num * (byteMap[unit] || 0)
    }
  }
  
  return 0
}

module.exports = {
  datetime , byte , retrieveByte
}