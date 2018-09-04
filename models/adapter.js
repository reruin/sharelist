
const folder = (d) => {
  let name = d.name
  let provider = (name.match(/(?<=\.)(od|gd|remote|xd|ld)$/) || [0])[0]

  if( provider ){
    if(provider == 'xd'){
      d.name = name.replace('.xd' , '')
      d.id = d.id + '@' + d.provider
    }else{
      let r = name.split('.')
      let id = r[r.length-2]
      let newname = r.slice(0,-2).join('') || id
      if(id) d.id = id
      if(newname) d.name = newname
    }

    d.provider = provider
    d.type = 'folder'
  }
  return d
}


module.exports = { folder }