const CTX_USER = Symbol('ctx#user');
const { nanoid } = require('nanoid')

module.exports = (options, app) => async (ctx, next) => {

  // const user = ctx[CTX_USER]
  let token = ctx.get('authorization') || ctx.query.token
  let isAdmin = app.sharelist.config.token && app.sharelist.config.token === token

  if (isAdmin) {
    await next()
  } else {
    ctx.body = { error: { code: 401, message: 'Invalid password' } }
  }
}