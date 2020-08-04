const name = 'CaiYun'

const version = '1.0'

const protocols = ['cy']

const defaultProtocol = 'cy'

const { URL } = require('url')

const urlFormat = require('url').format

const COOKIE_MAX_AGE = 300 * 24 * 60 * 60 * 1000 // 300 days

const max_age_dir = 10 * 60 * 1000

const RSAUtils = (function(){var $w={};if(typeof $w.RSAUtils==="undefined"){var RSAUtils=$w.RSAUtils={}}var biRadixBase=2;var biRadixBits=16;var bitsPerDigit=biRadixBits;var biRadix=1<<16;var biHalfRadix=biRadix>>>1;var biRadixSquared=biRadix*biRadix;var maxDigitVal=biRadix-1;var maxInteger=9999999999999998;var maxDigits;var ZERO_ARRAY;var bigZero,bigOne;var BigInt=$w.BigInt=function(flag){if(typeof flag=="boolean"&&flag==true){this.digits=null}else{this.digits=ZERO_ARRAY.slice(0)}this.isNeg=false};RSAUtils.setMaxDigits=function(value){maxDigits=value;ZERO_ARRAY=new Array(maxDigits);for(var iza=0;iza<ZERO_ARRAY.length;iza++){ZERO_ARRAY[iza]=0}bigZero=new BigInt();bigOne=new BigInt();bigOne.digits[0]=1};RSAUtils.setMaxDigits(20);var dpl10=15;RSAUtils.biFromNumber=function(i){var result=new BigInt();result.isNeg=i<0;i=Math.abs(i);var j=0;while(i>0){result.digits[j++]=i&maxDigitVal;i=Math.floor(i/biRadix)}return result};var lr10=RSAUtils.biFromNumber(1000000000000000);RSAUtils.biFromDecimal=function(s){var isNeg=s.charAt(0)=="-";var i=isNeg?1:0;var result;while(i<s.length&&s.charAt(i)=="0"){++i}if(i==s.length){result=new BigInt()}else{var digitCount=s.length-i;var fgl=digitCount%dpl10;if(fgl==0){fgl=dpl10}result=RSAUtils.biFromNumber(Number(s.substr(i,fgl)));i+=fgl;while(i<s.length){result=RSAUtils.biAdd(RSAUtils.biMultiply(result,lr10),RSAUtils.biFromNumber(Number(s.substr(i,dpl10))));i+=dpl10}result.isNeg=isNeg}return result};RSAUtils.biCopy=function(bi){var result=new BigInt(true);result.digits=bi.digits.slice(0);result.isNeg=bi.isNeg;return result};RSAUtils.reverseStr=function(s){var result="";for(var i=s.length-1;i>-1;--i){result+=s.charAt(i)}return result};var hexatrigesimalToChar=["0","1","2","3","4","5","6","7","8","9","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];RSAUtils.biToString=function(x,radix){var b=new BigInt();b.digits[0]=radix;var qr=RSAUtils.biDivideModulo(x,b);var result=hexatrigesimalToChar[qr[1].digits[0]];while(RSAUtils.biCompare(qr[0],bigZero)==1){qr=RSAUtils.biDivideModulo(qr[0],b);digit=qr[1].digits[0];result+=hexatrigesimalToChar[qr[1].digits[0]]}return(x.isNeg?"-":"")+RSAUtils.reverseStr(result)};RSAUtils.biToDecimal=function(x){var b=new BigInt();b.digits[0]=10;var qr=RSAUtils.biDivideModulo(x,b);var result=String(qr[1].digits[0]);while(RSAUtils.biCompare(qr[0],bigZero)==1){qr=RSAUtils.biDivideModulo(qr[0],b);result+=String(qr[1].digits[0])}return(x.isNeg?"-":"")+RSAUtils.reverseStr(result)};var hexToChar=["0","1","2","3","4","5","6","7","8","9","a","b","c","d","e","f"];RSAUtils.digitToHex=function(n){var mask=15;var result="";for(i=0;i<4;++i){result+=hexToChar[n&mask];n>>>=4}return RSAUtils.reverseStr(result)};RSAUtils.biToHex=function(x){var result="";var n=RSAUtils.biHighIndex(x);for(var i=RSAUtils.biHighIndex(x);i>-1;--i){result+=RSAUtils.digitToHex(x.digits[i])}return result};RSAUtils.charToHex=function(c){var ZERO=48;var NINE=ZERO+9;var littleA=97;var littleZ=littleA+25;var bigA=65;var bigZ=65+25;var result;if(c>=ZERO&&c<=NINE){result=c-ZERO}else{if(c>=bigA&&c<=bigZ){result=10+c-bigA}else{if(c>=littleA&&c<=littleZ){result=10+c-littleA}else{result=0}}}return result};RSAUtils.hexToDigit=function(s){var result=0;var sl=Math.min(s.length,4);for(var i=0;i<sl;++i){result<<=4;result|=RSAUtils.charToHex(s.charCodeAt(i))}return result};RSAUtils.biFromHex=function(s){var result=new BigInt();var sl=s.length;for(var i=sl,j=0;i>0;i-=4,++j){result.digits[j]=RSAUtils.hexToDigit(s.substr(Math.max(i-4,0),Math.min(i,4)))}return result};RSAUtils.biFromString=function(s,radix){var isNeg=s.charAt(0)=="-";var istop=isNeg?1:0;var result=new BigInt();var place=new BigInt();place.digits[0]=1;for(var i=s.length-1;i>=istop;i--){var c=s.charCodeAt(i);var digit=RSAUtils.charToHex(c);var biDigit=RSAUtils.biMultiplyDigit(place,digit);result=RSAUtils.biAdd(result,biDigit);place=RSAUtils.biMultiplyDigit(place,radix)}result.isNeg=isNeg;return result};RSAUtils.biDump=function(b){return(b.isNeg?"-":"")+b.digits.join(" ")};RSAUtils.biAdd=function(x,y){var result;if(x.isNeg!=y.isNeg){y.isNeg=!y.isNeg;result=RSAUtils.biSubtract(x,y);y.isNeg=!y.isNeg}else{result=new BigInt();var c=0;var n;for(var i=0;i<x.digits.length;++i){n=x.digits[i]+y.digits[i]+c;result.digits[i]=n%biRadix;c=Number(n>=biRadix)}result.isNeg=x.isNeg}return result};RSAUtils.biSubtract=function(x,y){var result;if(x.isNeg!=y.isNeg){y.isNeg=!y.isNeg;result=RSAUtils.biAdd(x,y);y.isNeg=!y.isNeg}else{result=new BigInt();var n,c;c=0;for(var i=0;i<x.digits.length;++i){n=x.digits[i]-y.digits[i]+c;result.digits[i]=n%biRadix;if(result.digits[i]<0){result.digits[i]+=biRadix}c=0-Number(n<0)}if(c==-1){c=0;for(var i=0;i<x.digits.length;++i){n=0-result.digits[i]+c;result.digits[i]=n%biRadix;if(result.digits[i]<0){result.digits[i]+=biRadix}c=0-Number(n<0)}result.isNeg=!x.isNeg}else{result.isNeg=x.isNeg}}return result};RSAUtils.biHighIndex=function(x){var result=x.digits.length-1;while(result>0&&x.digits[result]==0){--result
}return result};RSAUtils.biNumBits=function(x){var n=RSAUtils.biHighIndex(x);var d=x.digits[n];var m=(n+1)*bitsPerDigit;var result;for(result=m;result>m-bitsPerDigit;--result){if((d&32768)!=0){break}d<<=1}return result};RSAUtils.biMultiply=function(x,y){var result=new BigInt();var c;var n=RSAUtils.biHighIndex(x);var t=RSAUtils.biHighIndex(y);var u,uv,k;for(var i=0;i<=t;++i){c=0;k=i;for(j=0;j<=n;++j,++k){uv=result.digits[k]+x.digits[j]*y.digits[i]+c;result.digits[k]=uv&maxDigitVal;c=uv>>>biRadixBits}result.digits[i+n+1]=c}result.isNeg=x.isNeg!=y.isNeg;return result};RSAUtils.biMultiplyDigit=function(x,y){var n,c,uv;result=new BigInt();n=RSAUtils.biHighIndex(x);c=0;for(var j=0;j<=n;++j){uv=result.digits[j]+x.digits[j]*y+c;result.digits[j]=uv&maxDigitVal;c=uv>>>biRadixBits}result.digits[1+n]=c;return result};RSAUtils.arrayCopy=function(src,srcStart,dest,destStart,n){var m=Math.min(srcStart+n,src.length);for(var i=srcStart,j=destStart;i<m;++i,++j){dest[j]=src[i]}};var highBitMasks=[0,32768,49152,57344,61440,63488,64512,65024,65280,65408,65472,65504,65520,65528,65532,65534,65535];RSAUtils.biShiftLeft=function(x,n){var digitCount=Math.floor(n/bitsPerDigit);var result=new BigInt();RSAUtils.arrayCopy(x.digits,0,result.digits,digitCount,result.digits.length-digitCount);var bits=n%bitsPerDigit;var rightBits=bitsPerDigit-bits;for(var i=result.digits.length-1,i1=i-1;i>0;--i,--i1){result.digits[i]=((result.digits[i]<<bits)&maxDigitVal)|((result.digits[i1]&highBitMasks[bits])>>>(rightBits))}result.digits[0]=((result.digits[i]<<bits)&maxDigitVal);result.isNeg=x.isNeg;return result};var lowBitMasks=[0,1,3,7,15,31,63,127,255,511,1023,2047,4095,8191,16383,32767,65535];RSAUtils.biShiftRight=function(x,n){var digitCount=Math.floor(n/bitsPerDigit);var result=new BigInt();RSAUtils.arrayCopy(x.digits,digitCount,result.digits,0,x.digits.length-digitCount);var bits=n%bitsPerDigit;var leftBits=bitsPerDigit-bits;for(var i=0,i1=i+1;i<result.digits.length-1;++i,++i1){result.digits[i]=(result.digits[i]>>>bits)|((result.digits[i1]&lowBitMasks[bits])<<leftBits)}result.digits[result.digits.length-1]>>>=bits;result.isNeg=x.isNeg;return result};RSAUtils.biMultiplyByRadixPower=function(x,n){var result=new BigInt();RSAUtils.arrayCopy(x.digits,0,result.digits,n,result.digits.length-n);return result};RSAUtils.biDivideByRadixPower=function(x,n){var result=new BigInt();RSAUtils.arrayCopy(x.digits,n,result.digits,0,result.digits.length-n);return result};RSAUtils.biModuloByRadixPower=function(x,n){var result=new BigInt();RSAUtils.arrayCopy(x.digits,0,result.digits,0,n);return result};RSAUtils.biCompare=function(x,y){if(x.isNeg!=y.isNeg){return 1-2*Number(x.isNeg)}for(var i=x.digits.length-1;i>=0;--i){if(x.digits[i]!=y.digits[i]){if(x.isNeg){return 1-2*Number(x.digits[i]>y.digits[i])}else{return 1-2*Number(x.digits[i]<y.digits[i])}}}return 0};RSAUtils.biDivideModulo=function(x,y){var nb=RSAUtils.biNumBits(x);var tb=RSAUtils.biNumBits(y);var origYIsNeg=y.isNeg;var q,r;if(nb<tb){if(x.isNeg){q=RSAUtils.biCopy(bigOne);q.isNeg=!y.isNeg;x.isNeg=false;y.isNeg=false;r=biSubtract(y,x);x.isNeg=true;y.isNeg=origYIsNeg}else{q=new BigInt();r=RSAUtils.biCopy(x)}return[q,r]}q=new BigInt();r=x;var t=Math.ceil(tb/bitsPerDigit)-1;var lambda=0;while(y.digits[t]<biHalfRadix){y=RSAUtils.biShiftLeft(y,1);++lambda;++tb;t=Math.ceil(tb/bitsPerDigit)-1}r=RSAUtils.biShiftLeft(r,lambda);nb+=lambda;var n=Math.ceil(nb/bitsPerDigit)-1;var b=RSAUtils.biMultiplyByRadixPower(y,n-t);while(RSAUtils.biCompare(r,b)!=-1){++q.digits[n-t];r=RSAUtils.biSubtract(r,b)}for(var i=n;i>t;--i){var ri=(i>=r.digits.length)?0:r.digits[i];var ri1=(i-1>=r.digits.length)?0:r.digits[i-1];var ri2=(i-2>=r.digits.length)?0:r.digits[i-2];var yt=(t>=y.digits.length)?0:y.digits[t];var yt1=(t-1>=y.digits.length)?0:y.digits[t-1];if(ri==yt){q.digits[i-t-1]=maxDigitVal}else{q.digits[i-t-1]=Math.floor((ri*biRadix+ri1)/yt)}var c1=q.digits[i-t-1]*((yt*biRadix)+yt1);var c2=(ri*biRadixSquared)+((ri1*biRadix)+ri2);while(c1>c2){--q.digits[i-t-1];c1=q.digits[i-t-1]*((yt*biRadix)|yt1);c2=(ri*biRadix*biRadix)+((ri1*biRadix)+ri2)}b=RSAUtils.biMultiplyByRadixPower(y,i-t-1);r=RSAUtils.biSubtract(r,RSAUtils.biMultiplyDigit(b,q.digits[i-t-1]));if(r.isNeg){r=RSAUtils.biAdd(r,b);--q.digits[i-t-1]}}r=RSAUtils.biShiftRight(r,lambda);q.isNeg=x.isNeg!=origYIsNeg;if(x.isNeg){if(origYIsNeg){q=RSAUtils.biAdd(q,bigOne)}else{q=RSAUtils.biSubtract(q,bigOne)}y=RSAUtils.biShiftRight(y,lambda);r=RSAUtils.biSubtract(y,r)}if(r.digits[0]==0&&RSAUtils.biHighIndex(r)==0){r.isNeg=false}return[q,r]};RSAUtils.biDivide=function(x,y){return RSAUtils.biDivideModulo(x,y)[0]};RSAUtils.biModulo=function(x,y){return RSAUtils.biDivideModulo(x,y)[1]};RSAUtils.biMultiplyMod=function(x,y,m){return RSAUtils.biModulo(RSAUtils.biMultiply(x,y),m)};RSAUtils.biPow=function(x,y){var result=bigOne;var a=x;while(true){if((y&1)!=0){result=RSAUtils.biMultiply(result,a)}y>>=1;if(y==0){break}a=RSAUtils.biMultiply(a,a)}return result};RSAUtils.biPowMod=function(x,y,m){var result=bigOne;
var a=x;var k=y;while(true){if((k.digits[0]&1)!=0){result=RSAUtils.biMultiplyMod(result,a,m)}k=RSAUtils.biShiftRight(k,1);if(k.digits[0]==0&&RSAUtils.biHighIndex(k)==0){break}a=RSAUtils.biMultiplyMod(a,a,m)}return result};$w.BarrettMu=function(m){this.modulus=RSAUtils.biCopy(m);this.k=RSAUtils.biHighIndex(this.modulus)+1;var b2k=new BigInt();b2k.digits[2*this.k]=1;this.mu=RSAUtils.biDivide(b2k,this.modulus);this.bkplus1=new BigInt();this.bkplus1.digits[this.k+1]=1;this.modulo=BarrettMu_modulo;this.multiplyMod=BarrettMu_multiplyMod;this.powMod=BarrettMu_powMod};function BarrettMu_modulo(x){var $dmath=RSAUtils;var q1=$dmath.biDivideByRadixPower(x,this.k-1);var q2=$dmath.biMultiply(q1,this.mu);var q3=$dmath.biDivideByRadixPower(q2,this.k+1);var r1=$dmath.biModuloByRadixPower(x,this.k+1);var r2term=$dmath.biMultiply(q3,this.modulus);var r2=$dmath.biModuloByRadixPower(r2term,this.k+1);var r=$dmath.biSubtract(r1,r2);if(r.isNeg){r=$dmath.biAdd(r,this.bkplus1)}var rgtem=$dmath.biCompare(r,this.modulus)>=0;while(rgtem){r=$dmath.biSubtract(r,this.modulus);rgtem=$dmath.biCompare(r,this.modulus)>=0}return r}function BarrettMu_multiplyMod(x,y){var xy=RSAUtils.biMultiply(x,y);return this.modulo(xy)}function BarrettMu_powMod(x,y){var result=new BigInt();result.digits[0]=1;var a=x;var k=y;while(true){if((k.digits[0]&1)!=0){result=this.multiplyMod(result,a)}k=RSAUtils.biShiftRight(k,1);if(k.digits[0]==0&&RSAUtils.biHighIndex(k)==0){break}a=this.multiplyMod(a,a)}return result}var RSAKeyPair=function(encryptionExponent,decryptionExponent,modulus){var $dmath=RSAUtils;this.e=$dmath.biFromHex(encryptionExponent);this.d=$dmath.biFromHex(decryptionExponent);this.m=$dmath.biFromHex(modulus);this.chunkSize=2*$dmath.biHighIndex(this.m);this.radix=16;this.barrett=new $w.BarrettMu(this.m)};RSAUtils.getKeyPair=function(encryptionExponent,decryptionExponent,modulus){return new RSAKeyPair(encryptionExponent,decryptionExponent,modulus)};if(typeof $w.twoDigit==="undefined"){$w.twoDigit=function(n){return(n<10?"0":"")+String(n)}}RSAUtils.encryptedString=function(key,s){var a=[];var sl=s.length;var i=0;while(i<sl){a[i]=s.charCodeAt(i);i++}while(a.length%key.chunkSize!=0){a[i++]=0}var al=a.length;var result="";var j,k,block;for(i=0;i<al;i+=key.chunkSize){block=new BigInt();j=0;for(k=i;k<i+key.chunkSize;++j){block.digits[j]=a[k++];block.digits[j]+=a[k++]<<8}var crypt=key.barrett.powMod(block,key.e);var text=key.radix==16?RSAUtils.biToHex(crypt):RSAUtils.biToString(crypt,key.radix);result+=text+" "}return result.substring(0,result.length-1)};RSAUtils.decryptedString=function(key,s){var blocks=s.split(" ");var result="";var i,j,block;for(i=0;i<blocks.length;++i){var bi;if(key.radix==16){bi=RSAUtils.biFromHex(blocks[i])}else{bi=RSAUtils.biFromString(blocks[i],key.radix)}block=key.barrett.powMod(bi,key.d);for(j=0;j<=RSAUtils.biHighIndex(block);++j){result+=String.fromCharCode(block.digits[j]&255,block.digits[j]>>8)}}if(result.charCodeAt(result.length-1)==0){result=result.substring(0,result.length-1)}return result};RSAUtils.setMaxDigits(200);return RSAUtils})();

const errorCode = {
    "300": "请输入正确图形验证码",
    "301": "请输入图形验证码",
    "400": "请输入正确的手机号码",
    "401": "密码错误，请输入正确的密码",
    "404": "用户不存在",
    "410": "图形验证码已失效，请刷新图形验证码",
    "420": "图形验证码错误，请重新输入",
    "421": "请您输入验证码",
    "431": "用户正在更换飞信号，暂时无法登陆",
    "432": "该飞信号已停止使用，请使用新帐号登录",
    "435": "用户手机已销号，未绑定安全邮箱",
    "490": "已发送短信验证码，请1分钟后重试！",
    "500": "系统繁忙，请稍后再试",
    AAS_9103: "帐号或密码不正确，请重新输入",
    CUSTOM_AAS_9103: "帐号或密码不正确，请重新输入",
    AAS_9431: "仅支持中国移动用户",
    AAS_9441: "帐号或密码不正确，请重新输入",
    CUSTOM_AAS_9441: "短信验证码错误",
    AAS_9442: "短信验证码失效，请重新获取",
    AAS_9999: "用户名或密码错误，请重试",
    AAS_200059504: "帐号或密码不正确，请重新输入",
    AAS_200059508: "今日验证码短信已达上限",
    AAS_200059505: "帐号已被冻结，请24小时后再试",
    AAS_200050401: "帐号或密码不正确，请重新输入",
    AAS_200050411: '为保障帐号安全，请<a id="umc_url_bindphone" style="color:#5b28ad;" href="https://www.cmpassport.com" target="_blank">绑定手机号</a>后重试',
    AAS_200050422: "验证码错误，请重新输入",
    AAS_200050423: "请您输入验证码",
    AAS_200050432: "您已关闭和彩云业务，如需使用请重新开启",
    AAS_200050434: "移动通行证被锁定，请稍后再试",
    AAS_200059512: "验证码错误，请重新输入",
    AAS_200059521: "帐号或密码不正确，请重新输入",
    AAS_200050442: ""
}
//https://github.com/nodejs/node/issues/24471
const install = async (msg) => {
  return `
    <div class="auth">
      <h3>和彩云 挂载向导</h3>
      ${ msg ? '<p style="font-size:12px;">'+msg+'</p>' : '' }
      <div>
        <form class="form-horizontal" method="post">
          <input type="hidden" name="act" value="install" />
          <div class="form-group"><input class="sl-input" type="text" name="username" value="" placeholder="用户名" /></div>
          <div class="form-group"><input class="sl-input" type="password" name="password" value="" placeholder="密码" /></div>
          <button class="sl-button btn-primary" id="signin" type="submit">验证</button></form>
      </div>
    </div>
  `
}

const captchaPage = async (data) => {
  return `
    <div class="auth">
      <h3>和彩云 挂载向导</h3>
      <p style="font-size:12px;">请输入验证码
        <img src="${data.img}" />
      </p>
      <div>
        <form class="form-horizontal" method="post">
          <input type="hidden" name="act" value="install" />
          <input type="hidden" name="username" value="${data.username}" />
          <input type="hidden" name="password" value="${data.password}" />
          <input type="hidden" name="key" value="${data.key}" />
          <div class="form-group"><input class="sl-input" type="text" placeholder="验证码" name="captcha" value="" /></div>
          <button class="sl-button btn-primary" id="signin" type="submit">确定</button></form>
      </div>
    </div>
  `
}

const encrypt = (exponent, modulus , data) => {
  let key = RSAUtils.getKeyPair(exponent,"",modulus);
  return Buffer.from(RSAUtils.encryptedString(key, data.split("").reverse().join(""))).toString('base64')
}

//yyyyMMddhhmmss
const convTime = (d) => {
  return d.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/g,'$1-$2-$3T$4:$5:$6+08:00')
}

class Manager {
  constructor(request, recognize, updateHandle, codeHandle) {
    this.clientMap = {}
    this.request = request
    this.recognize = recognize
    this.updateHandle = updateHandle
    this.codeHandle = codeHandle

    this.captchaProcess = {}
  }

  async ocr(image){
    let resp = await this.recognize(image,'caiyun')
    let ret = { error:resp.error }
    if(!resp.error){
      let code = resp.result.replace(/[^a-z0-9]/i,'')
      // retry
      if(code.length == 4){
        ret.code = code
      }else{
        ret.code = ''
      }
    }

    return ret
  }

  init(d){
    for(let i of d) {
      let data = this.parse(i.path)
      this.clientMap[data.username] = data
    }
  }

  // 根据id 获取
  async get(id){
    let data = this.parse(id)
    if(data.username){
      let hit = this.clientMap[data.username]
      if(hit){
        if( !hit.cookie || (Date.now() - hit.updated_at) > COOKIE_MAX_AGE ){
          let { result , msg , ...rest } = await this.create(hit.username , hit.password)
          if( result ){
            hit = this.clientMap[data.username]
          }else{
            return { error: msg, ...rest }
          }
        }
      }

      if(hit){
        let p = (data.path == '/' || data.path == '') ? '00019700101000000001' : data.path
        return { ...hit, path:p }
      }else{
        return { error:'挂载失败，请确保账号或者密码正确' }
      }
    }

    return { error:'' }
  }

  parse(path , name){
    let data = new URL(path)
    return {
      name,
      username:data.hostname,
      password:data.searchParams.get('password'),
      cookie:data.searchParams.get('cookie'),
      protocol:data.protocol.split(':')[0],
      path: data.pathname.replace(/^\//,''),
    }
  }

  stringify({ path , username , password , cookie }){
    let query = {}
    if(password) query.password = password
    if(cookie) query.cookie = cookie
    return urlFormat({
      protocol: defaultProtocol,
      hostname: username,
      pathname: (path == '' ) ? '/' : path,
      slashes:true,
      query,
    })
  }

  hasCaptchaTask(id){
    return id in this.captchaProcess
  }

  async resumeCaptchaTask(id , captcha){
    let {username , password} = this.captchaProcess[id]
    return await this.create(username , password,id , captcha)
  }

  //create cookie
  async create(username , password, captchaId, captcha){
    let publicKeyExponent, publicKeyModulus, cookie
    let needcaptcha = false, retry = 0
    if( captchaId && this.captchaProcess[captchaId]){
      let d = this.captchaProcess[captchaId]
      publicKeyExponent = d.publicKeyExponent
      publicKeyModulus = d.publicKeyModulus
      cookie = d.cookie

      retry = 0
      needcaptcha = true
    }else{
      //0 准备工作： 获取必要数据
      let headers = {'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'}
      let { body , headers:headers2} = await this.request.get('https://caiyun.feixin.10086.cn/',{headers})

      publicKeyExponent = (body.match(/var publicKeyExponent = ['"](.*?)['"];/) || ['',''])[1]
      publicKeyModulus = (body.match(/var publicKeyModulus = ['"](.*?)['"];/) || ['',''])[1]

      cookie = headers2['set-cookie'].join('; ')
    }


    let formdata = {
      'autotype': '1',
      'blframe':'true',
      'hidden_verfycode':'', // true
      'callback':'caiyun',
      'password':encrypt(publicKeyExponent,publicKeyModulus,password),
      'encryptAccount':encrypt(publicKeyExponent,publicKeyModulus,username),
      'encodeType':'1',
      'validate':'',//验证码
    }
    if( captcha ) {
      formdata.validate = captcha
      formdata.hidden_verfycode = 'true'
    }
    let result = false
    let msg = ''

    while(true){
      // 0 验证码
      if(needcaptcha && !formdata.validate){
        
        let captchaUrl = `https://caiyun.feixin.10086.cn/Mcloud/sso/passverifycode.action?date=${Date.now()}&errorpwd=1&account=${encrypt(publicKeyExponent,publicKeyModulus,username)}`
        let resp = await this.request.get(captchaUrl,{
          headers:{
            "accept": "image/webp,image/apng,image/*,*/*;q=0.8",
            "accept-language": "zh-CN,zh;q=0.9",
            Cookie:cookie,
            Referer:'https://caiyun.feixin.10086.cn/',
          },
          encoding: null
        })

        let imgBase64
        if(resp.body){
          imgBase64 = "data:" + resp.headers["content-type"] + ";base64," + Buffer.from(resp.body).toString('base64');
        }
        if(retry <= 0){
          let key = captchaId || Math.random()
          this.captchaProcess[key] = { username,password,publicKeyExponent,publicKeyModulus,cookie }
          return { result:false , custom:{key , img:imgBase64} }
        }
        retry--
        let { error , code } = await this.ocr(imgBase64)
        console.log(error,code)
        //服务不可用
        if(error){
          console.log('服务不可用')
          formdata.validateCode = ''
          msg = '验证码识别服务不可用！'
          break;
        }
        else if(code){
          formdata.validate = code
          console.log('validateCode:['+code+']')
        }
        //无法有效识别
        else{
          console.log('无法有效识别')
          continue;
        }
        
      }

      delete this.captchaProcess[captchaId]
      // 1 登陆
      let resp = await this.request({
        url:'https://caiyun.feixin.10086.cn/sso/cmlogin.action',
        method:'POST',
        form:formdata ,
        "headers": {
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
          "accept-language": "zh-CN,zh;q=0.9",
          "cache-control": "max-age=0",
          "content-type": "application/x-www-form-urlencoded",
          "cookie": cookie,
          "referrer": "https://caiyun.feixin.10086.cn/",
        },

        async:true,
        followRedirect:false
      })
      if(resp.headers && resp.headers['location']){
        let success = false , code
        try{
          let u = JSON.parse('['+resp.headers['location'].split('u=')[1]+']')
          //let [success , code , data] = u
          success = u[0] == 'true'
          code = u[1]
        }catch(e){
          code = '无法获取回调'
        }

        if(!success){
          if (["421",'420','AAS_200050423','AAS_200050422','AAS_200059504','AAS_9441'].includes(code)) {
            needcaptcha = true
            continue;
          }else if(['AAS_200059512','AAS_200050422'].includes(code)){
            console.log('validateCode:['+formdata.validate+'] error')
            formdata.validate = ''
            //验证码错误
            continue;
          }else if(errorCode[code]){
            msg = errorCode[code]
            break;
          }else{
            msg = '错误：'+code
            break;
          }
        }else{
          let cookie = resp.headers['set-cookie'].join('; ')
          let client = { username , password , cookie , updated_at: Date.now() }
          if(this.clientMap[username]){
            client.path = this.clientMap[username].path
          }
          await this.updateHandle(this.stringify(client))
          this.clientMap[username] = client
          result = true
          break;
        }
      }
    }

    return { result , msg }
  }

  async update(id){
    let data = this.parse(id)

    if(data.username){
      let hit = this.clientMap[data.username]
      if(hit){
        return await this.create(hit.username , hit.password)
      }
    }
  }
}
// fileid->app_credentials
module.exports = ({ request, cache, getConfig, querystring, base64, saveDrive, getDrive, getDrives , getRuntime , wrapReadableStream, recognize}) => {

  const manager = new Manager(request , recognize, async (client) => {
    let paths = await getDrives()
    let data = paths
      .map(i => manager.parse(i.path , i.name))


    const name = decodeURIComponent(getRuntime('req').path.replace(/^\//g,''))
    let hit = data.filter(i => i.name == name)

    //路径也无法匹配
    if( hit.length == 0 ){
      //仅有一个可用挂载源
      if(data.length == 1 && paths.length == 1 && paths[0].root){
        hit = data
      }
    }

    hit.forEach(i => {
      saveDrive(client , i.name)
    })
  })

  //获取所有相关根目录，并创建凭证
  getDrives().then(resp => {
    manager.init(resp)
  })

  const afterPrepare = async (data = {},id,req) => {
    let { result , msg , custom } = data
    if( result ){
      return { id, type: 'folder', protocol: defaultProtocol,redirect: req.origin + req.path }
    }else{
      if( custom ){
        return { id, type: 'folder', protocol: defaultProtocol,body: await captchaPage({username:data.username,password:data.password,...custom}) }
      }
      else {
        return { id, type: 'folder', protocol: defaultProtocol,body: await install(msg || '请确认账号密码正确') }
      }
    }
  }

  const prepare = async (id) => {
    if(!id.startsWith(defaultProtocol)){
      id = defaultProtocol + ':' + id
    }
    const req = getRuntime('req')

    let baseUrl = req.origin + req.path

    //验证码
    if( req.body && req.body.key && req.body.captcha && manager.hasCaptchaTask(req.body.key)){
      return await afterPrepare(await manager.resumeCaptchaTask(req.body.key,req.body.captcha ),id , req) 
    }

    let { path, cookie, username, password, error , custom } = await manager.get(id)

    if( cookie ) {
      return { cookie , path , username }
    }else{
      if (req.body && req.body.username && req.body.password && req.body.act == 'install') {
        let { username, password,key,captcha} = req.body
        let data = await manager.create(username , password,key,captcha)
        return await afterPrepare(data,id , req)
      }
      else if(custom){
        return { id, type: 'folder', protocol: defaultProtocol,body: await captchaPage({username,password,...custom}) }
      }

      return { id, type: 'folder', protocol: defaultProtocol,body: await install(error) }
    }

  }

  const fetchData = async (id,rest) => {
    let resp , retry_times = 5
    while(true && --retry_times){
      resp = await request({async:true,...rest})
      //cookie失效
      if(resp.body && resp.body.message == 'timeout'){
        await manager.update(id)
        continue
      }else{
        break;
      }
    }
    
    return resp
  }

  const folder = async (id, options) => {

    let predata = await prepare(id)

    if (!predata.cookie) return predata

    let { path, cookie , username , error } = await prepare(id)

    if(error){
      return { id, type: 'folder', protocol: defaultProtocol,body:'异常：'+error }
    }
    let r = cache.get(id)
    if (r) {
      if (
        r.$cached_at &&
        r.children &&
        (Date.now() - r.$cached_at < max_age_dir)

      ) {
        console.log(Date.now()+' CACHE caiyun '+ id)
        return r
      }
    }
   
    let resp = await fetchData(id,{
      url:`https://caiyun.feixin.10086.cn/portal/webdisk2/queryContentAndCatalog!disk.action`,
      method:'POST',
      form:{
        startNumber: 1,
        endNumber: 9999,
        catalogSortType: 0,
        contentSortType: 0,
        sortDirection: 1,
        contentID: path.split('/').pop(),
        isTimerShaft: 0,
        isQueryLast: 0,
        path,
      },
      headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
        'Referer': 'https://caiyun.feixin.10086.cn/portal/index.jsp',
        'Cookie': cookie,
      },
      json:true
    })

    if (!resp || !resp.body) {
      return { id, type: 'folder', protocol: defaultProtocol,body:'解析错误' }
    }
    let children = [].concat(resp.body.dci.cataloginfos || [],resp.body.dci.contents || []).map( file => {
      let folder = !!file.ETagOprType
      let subid = path + '/' + (folder ? file.catalogID : file.contentID)
      let item = {
        id: manager.stringify({username , path:subid}),
        name: folder ? file.catalogName : file.contentName,
        protocol: defaultProtocol,
        created_at: convTime(folder ? file.createTime : file.uploadTime),
        updated_at: convTime(file.updateTime),
        type: folder ? 'folder' : 'file',
      }
      if( !folder ){
        item.ext = file.contentSuffix
        item.size = parseInt(file.contentSize)
        item.url = 'https:'+file.downloadUrl
        item.thumb = file.thumbnailURL
      }

      return item
    })
    let result = { id, type: 'folder', protocol: defaultProtocol }
    result.$cached_at = Date.now()
    result.children = children
    cache.set(id, result)

    return result
  }

  // 无临时链接 强制中转
  const file = async (id, options) => {
    let predata = await prepare(id)
    if (!predata.cookie) return predata

    let { path, cookie , username } = await prepare(id)

    let data = options.data || {}
    let resp = await fetchData(id,{
      url:`https://caiyun.feixin.10086.cn/webdisk2/downLoadAction!downloadToPC.action?shareContentIDs=${id.split('/').pop()}`,
      method:'GET',
      headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
        'Cookie': cookie,
      },
      json:true
    })

    if(!resp) return false
    let url = resp.body.redirectURL

    resp = {
      id,
      url,
      name: data.name,
      ext: data.ext,
      protocol: defaultProtocol,
      size:data.size,
    }

    return resp
  }

  const createReadStream = async ({id , size , options = {}} = {}) => {
    let resp = await file(id)
    if(resp.body){
      return resp
    }else{
      let readstream = request({url:resp.url , method:'get'})
      return wrapReadableStream(readstream , { size: size } )
    }
  }

  return { name, label:'和彩云 账号登录版', version, drive: { protocols, folder, file , createReadStream  } }
}