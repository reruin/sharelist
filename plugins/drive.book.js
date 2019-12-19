//https://github.com/howie6879/owllook/blob/master/owllook/config/rules.py

/*
 * book://name
 */

const BLACK_DOMAIN  = ["www.17k.com","mm.17k.com","www.xs8.cn","www.zongheng.com","yunqi.qq.com","chuangshi.qq.com","book.qidian.com","www.soduso.com","pages.book.qq.com","book.km.com","www.lread.net","www.0dsw.com","www.5200xsb.com","www.80txt.com","www.sodu.tw","www.shuquge.com","www.shenmanhua.com","xiaoshuo.sogou.com","www.999wx.com","zetianji8.com","www.bookso.net","m.23us.com","www.qbxsw.com","www.zhuzhudao.com","www.shengyan.org","www.360doc.com","www.ishuo.cn","read.qidian.com","www.yunlaige.com","www.qidian.com","www.sodu888.com","www.siluke.cc","read.10086.cn","www.pbtxt.com","c4txt.com","www.bokon.net","www.sikushu.net","www.is028.cn","www.tadu.com","www.kudu8.com","www.bmwen.com","www.5858xs.com","www.yiwan.com","www.x81zw.com","www.123du.cc","www.chashu.cc","20xs.com","www.haxwx.net","www.dushiwenxue.com","www.yxdown.com","www.jingcaiyuedu.com","www.zhetian.org","www.xiaoshuo02.com","www.xiaoshuo77.com","www.868xh.com","dp.changyou.com","www.iyouman.com","www.qq717.com","www.yznn.com","www.69w.cc","www.doupocangqiong1.com","www.manhuatai.com","www.5wxs.com","www.ggshuji.com","www.msxf.net","www.mianhuatang.la","www.boluoxs.com","www.lbiquge.top","www.69shu.com","www.qingkan520.com","book.douban.com","movie.douban.com","www.txshuku.com","lz.book.sohu.com","www.3gsc.com.cn","www.txtshu365.com","www.517yuedu.com","www.baike.com","read.jd.com","www.zhihu.com","wshuyi.com","www.19lou.tw","www.chenwangbook.com","www.aqtxt.com","book.114la.com","www.niepo.net","me.qidian.com","www.gengd.com","www.77l.com","www.geilwx.com","www.97xiao.com","www.anqu.com","www.wuxiaxs.com","yuedu.163.com","b.faloo.com","bbs.qidian.com","jingji.qidian.com","www.sodu.cc","forum.qdmm.com","www.qdmm.com","game.91.com","www.11773.com","mt.sohu.com","book.dajianet.com","haokan.17k.com","www.qmdsj.com","www.jjwxc.net","ishare.iask.sina.com.cn","www.cmread.com","www.52ranwen.net","www.dingdianzw.com","www.topber.com","www.391k.com","www.qqxzb.com","www.zojpw.com","www.pp8.com","www.bxwx.org","www.hrsxb.com","www.497.com","www.d8qu.com","www.duwanjuan.com","www.05935.com","book.zongheng.com","www.55x.cn","www.freexs.cn","xiaoshuo.360.cn","www.3kw.cc","www.gzbpi.com","book.sina.com.cn","www.vodtw.com","wenda.so.com","product.dangdang.com","www.chuiyao.com","novel.slieny.com","www.bilibili.com","donghua.dmzj.com","www.yaojingweiba.com","www.qb5200.com","www.520tingshu.com","www.567zw.com","www.zjrxz.com","v.qq.com","blog.sina.com.cn","www.hackhome.com","news.fznews.com.cn","www.jingyu.com","news.so.com","www.sodu3.com","vipreader.qidian.com","www.mozhua9.com","www.iqiyi.com","xs.sogou.com","baike.so.com","qidian.com","www.qidian.com"]

const name = 'Book'

const version = '1.0'

const protocols = ['book']

const defaultProtocol = 'book'

const { URL } = require('url')

const urlFormat = require('url').format

const iconv = require('iconv-lite');

const parse = (id) => {
  if(id.startsWith('//') == false){
    id = defaultProtocol+'://'+id
  }
  let data = new URL(id)
  let ret = { protocol:defaultProtocol , name: data.host }
  for (const [key, value] of data.searchParams) {
    ret[key] = value
  }

  return ret
}

const format = (name , data) => {
  return urlFormat({
    protocol: defaultProtocol,
    slashes:true,
    hostname: name,
    query: data,
  })
}

const isValidDomain = (url) => {
  try{
    let d = new URL(url)
    if(d.hostname && !BLACK_DOMAIN.includes(d.hostname)){
      return true
    }else{
      return false
    }
  }catch(e){
    return false
  }
  
}

const RULES = {
  'www.biqukan.com':[/class="cover".*?src=\"([^\"]+?)"/,'/<dd>.*<a href=\"(.*?)\">(.*?)<\/dd>/g',1]
}

module.exports = ({ request , getConfig, base64 , extname }) => {

  const host = base64.decode('aHR0cHM6Ly9tLnNvLmNvbQ==')

  const createPage = async (id , name) => {
    let { body } = await request.get('https://m.so.com/index.php',{
      headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36'
      },
      qs:{
        src:'home-sug-store',
        ie:'utf-8',
        q:decodeURIComponent(name),
      }
    })

    let srouce = []
    let html = ''
    body.replace(/data\-pcurl=\"(.+?)\"[\w\W]+?cite>([\w\W]+?)<\/cite>/g , ($0 , $1 , $2)=>{
      if(isValidDomain($1)){
        srouce.push({name:$2 , url:$1})
      }
    })
    

    html = `
      <script src="https://cdn.bootcss.com/jquery/3.4.1/jquery.min.js"></script>
      <link rel="stylesheet" href="https://qidian.gtimg.com/qdm/css/read/index.a4aa5.css">
      <style>
        .book-src-item{
          display:block;
        }
        .app-book{
          position:absolute;
          top:0;left:0;
          width:100%;
          height:100%;
        }
        .page-read-cover{
          display:none;
        }
      </style>
      <div class="app-book skin-default">
        <div id="readCover" class="page-read-cover" ontouchmove="return false;">
          <div class="read-cover-v">
              <i class="read-cover-cor"></i><i class="read-cover-cor"></i><i class="read-cover-cor"></i><i class="read-cover-cor"></i>

              <div class="read-cover-info">
                  <figure class="read-cover-figure"><img src="//bookcover.yuewen.com/qdbimg/349573/1016732299/150" class="read-cover-img" alt="召唤诸天武将"></figure>
                  <h2 class="read-cover-title ell">召唤诸天武将</h2>
                  <p class="read-cover-author read-gray">医院骑士 著</p>

                  <table class="read-cover-data">
                      <tbody><tr>
                          <td width="30%"><strong>玄幻</strong><h6 class="read-gray">类型</h6></td>
                          <td><strong>2019.10.26</strong><h6 class="read-gray">上架</h6></td>
                          <td width="30%"><strong>32.64万</strong><h6 class="read-gray">连载（字）</h6></td>
                      </tr>
                  </tbody></table>
              </div>

              <div class="read-cover-copy">
                  <p class="read-gray">结果来自第三方搜索引擎，本站只展示搜索结果。</p>
              </div>
          </div>
          <div class="read-source">
          </div>
          <div class="read-cover-h" role="button" title="召唤诸天武将, 医院骑士 著, 轻触关闭书封，开始阅读，阅读时候，点击屏幕中间，可呼起操作栏"></div>
      </div>
      <div class="page-read"></div>
      <script>
        var sources = ${JSON.stringify(srouce)}

        if(sources && sources.length){
          var html = ''
          sources.forEach(function(i){
            html += '<a src="'+i.url+'">'+i.name+'</a>';
          });
          $('.read-source').html(html)
        }
      </script>
    </div>`
    
    return {
      id,
      protocol:defaultProtocol,
      body:html
    }
  }

  const getContent = async (data) => {
    let url = base64.decode(d.src)
    let { body } = await request.get(url,{
      encoding: null,
      headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36'
      }
    })

    let n = Buffer.from(body).toString('utf-8')

    if(/<meta[^>]+charset=gbk/.test(n)){
      n = iconv.decode(Buffer.from(body), 'GBK');
    }

  }

  const folder = async (id) => {
    //https://m.so.com/index.php?ie=utf-8&fr=so.com&src=home_so.com&q=%E7%AC%AC%E4%B8%80%E5%BA%8F%E5%88%97

    let d = parse(id)
    
    return {
      id,
      body:await createPage(d)
    }

  }

  const file = async (id , { data = {} } = {}) => {
    if( data && data.download_url ){
      data.url = data.download_url
    }else{
      data = await getContent(id)
      data.url = data.download_url
    }
    // data.outputType = 'stream'
    //data.proxy = 'stream'
    return data
  }

  return { name, version, drive: { protocols, folder, file } }
}