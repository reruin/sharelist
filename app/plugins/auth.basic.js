
module.exports = () => {
  const auth = {
    'basic':(user, passwd, content) => {
      return content.includes(`${user}:${passwd}`)
    }
  }
  return { name:'BasicAuth' , version:'1.0' , auth }
}