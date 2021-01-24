$(function(){
  var param = (location.search.match(/sort=([\w\W]+?)(&|$)/) || ['',''])[1]
  var sort = {}
  param.split('+').forEach(function(i){
    var pairs = i.split(':')
    if(pairs.length == 2){
      sort[pairs[0]] = pairs[1]
    } 
  })

  function reload(){
    var v = []
    for(var i in sort){
      if(sort[i]) v.push(i+':'+sort[i])
    }
    var sortstr = 'sort='+v.join('+')
    var searchParams = location.search

    if(v.length == 0){
      location.href = searchParams.replace(/sort=([\w\W]*?)(&|$)/,'')
    }else{
      if(searchParams){
        if(searchParams.indexOf('sort') >=0 ){
          location.href = searchParams.replace(/sort=([\w\W]+?)(&|$)/,sortstr)
        }else{
          location.href = searchParams + '&' + sortstr
        }
      }else{
        location.href = searchParams + '?'+ sortstr
      }
    }

  }
  //
  $('[data-sort]').on('click',function(){
    var el = $(this)
    var type = el.attr('data-sort')
    // [null,desc asc]
    var value = el.attr('data-sort-value')
    var currentValue = sort[type]
    //reset
    sort = {}
    sort[type] = currentValue == 'asc' ? '' : currentValue == 'desc' ? 'asc' : 'desc'
    reload()
  })
})