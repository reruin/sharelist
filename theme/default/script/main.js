function renderViewMode() {
  let isGrid = localStorage['viewport_mode'] == 'grid'
  if (isGrid) {
    $('.node-list').addClass('node-list--grid')
    $('.file-thumb-img').each(function(){
      $(this).css({'background':'url('+$(this).attr('data-src')+') center center / contain no-repeat'})
    })
    $('.menu-viewtype').addClass('menu-viewtype--grid')

  } else {
    $('.node-list').removeClass('node-list--grid')
    $('.file-thumb-img').each(function(){
      $(this).css({'background':'none'})
    })
    $('.menu-viewtype').removeClass('menu-viewtype--grid')
  }
}

var sortManager = (function(){
  var searchParams = {} ,sort = {}

  location.search.substring(1).split('&').forEach(function(i){
    let pairs =  i.split('=')
    if(pairs[0]){
      searchParams[pairs[0]] = pairs[1]
    }
  })

  if( searchParams.sort ){
    searchParams.sort.split('+').forEach(function(i) {
      var pairs = i.split(':')
      if (pairs.length == 2) {
        sort[pairs[0]] = pairs[1]
      }
    })
  }

  function reload(){
    var v = []
    for (var i in sort) {
      if (sort[i]) v.push(i + ':' + sort[i])
    }
    if(v.length > 0){
      searchParams['sort'] = v.join('+')
    }else{
      delete searchParams['sort']
    }

    var newSearch = [] , href = location.pathname
    for(var i in searchParams){
      newSearch.push(i+'='+searchParams[i])
    }
    if( newSearch.length ){
      href += '?'+newSearch.join('&')
    }

    location.href = href
  }

  function set(key,value,override){
    if( override === true ){
      sort = {}
    }

    sort[key] = value
  }

  function get(key){
    return sort[key]
  }

  return {
    reload:reload,
    set:set,
    get:get
  }
}())

$(function() {

  //
  $(document).on('click', '[data-sort]', function() {
    var el = $(this)
    var type = el.attr('data-sort')
    // [null,desc asc]
    var value = el.attr('data-sort-value')
    var currentValue = sortManager.get(type)
    //reset
    sortManager.set(type,currentValue == 'asc' ? '' : currentValue == 'desc' ? 'asc' : 'desc' , true)
    sortManager.reload()
  })

  $(document).on('click', '.menu-viewtype', function() {
    let isGrid = localStorage['viewport_mode'] == 'grid'
    localStorage['viewport_mode'] = isGrid ? 'list' : 'grid'
    renderViewMode()
  })

  renderViewMode()
})