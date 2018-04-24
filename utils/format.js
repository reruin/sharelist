function isDate(v){
  return Object.prototype.toString.call(v) === "[object Date]";
}

function isString(v) {
  return "string" === typeof v;
}

function datetime(date, expr) {
  expr = expr || 'yyyy-MM-dd'
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

function byte(v){
  if(!v){
    return '-'
  }

  let lo = 0
  
  while(v >= 1024){
    v /= 1024
    lo++
  }

  return Math.floor(v * 100) / 100 + ' ' + ['B','KB','MB','GB','TB'][lo]
}

function ln(v){
  let provider = (v.match(/\.(od|gd|remote)$/) || ['',''])[1]
  if( provider ){
    let r = v.split('.')
    let id = r[r.length-2]
    let name = r.slice(0,-2).join('') || id
    return { id , name , provider , type : 'folder'}
  }
}

module.exports = {
  datetime , byte , ln
}
