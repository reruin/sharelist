const { getOAuthAccessToken, PROXY_URL, render } = require('./shared')

module.exports = async function (ctx, next) {
  render(ctx, `<div class="auth">
  <h3>挂载 Aliyun Drive</h3>
  <p>参考<a href="https://media.cooluc.com/decode_token/">此链接</a></p>
  </div>`)
}