function renderViewMode() {
  let isGrid = localStorage['viewport_mode'] == 'grid'
  if (isGrid) {
    $('.node-list').addClass('node-list--grid')
    $('.file-thumb-img').each(function(){
      $(this).css({'background':'url('+$(this).attr('data-src')+') center center / contain no-repeat'})
    })
  } else {
    $('.node-list').removeClass('node-list--grid')
    $('.file-thumb-img').each(function(){
      $(this).css({'background':'none'})
    })
  }
}
$(function() {
  var param = (location.search.match(/sort=([\w\W]+?)(&|$)/) || ['', ''])[1]
  var sort = {}
  param.split('+').forEach(function(i) {
    var pairs = i.split(':')
    if (pairs.length == 2) {
      sort[pairs[0]] = pairs[1]
    }
  })

  function reload() {
    var v = []
    for (var i in sort) {
      if (sort[i]) v.push(i + ':' + sort[i])
    }
    var sortstr = 'sort=' + v.join('+')
    var searchParams = location.search

    if (v.length == 0) {
      location.href = searchParams.replace(/sort=([\w\W]*?)(&|$)/, '')
    } else {
      if (searchParams) {
        if (searchParams.indexOf('sort') >= 0) {
          location.href = searchParams.replace(/sort=([\w\W]+?)(&|$)/, sortstr)
        } else {
          location.href = searchParams + '&' + sortstr
        }
      } else {
        location.href = searchParams + '?' + sortstr
      }
    }

  }

  //
  $('[data-sort]').on('click', function() {
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

  $(document).on('click', '#j_vp', function() {
    let isGrid = localStorage['viewport_mode'] == 'grid'
    localStorage['viewport_mode'] = isGrid ? 'list' : 'grid'
    renderViewMode()
  })

  renderViewMode()
})