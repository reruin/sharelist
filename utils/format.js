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

  if( v < 1024 ){
    return v + ' B'
  }
  else if(v < 1024 * 1024){
    return Math.round( v / 1024) + ' KB'
  }
  else if( v < 1024 * 1024 * 1024){
    return Math.round( v / 1024 / 1024) + ' MB'
  }
  else if( v < 1024 * 1024 * 1024 * 1024){
    return Math.round( v*10 / 1024 / 1024 / 1024) / 10 + ' GB'
  }
  else{
    return Math.round( v*10/ 1024 / 1024 / 1024 / 1024)/10 + ' TB'
  }
}

module.exports = {
  datetime , byte
}
