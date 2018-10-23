const less = require('less-middleware');

module.exports = function() {
    let options = Array.prototype.slice.call(arguments);

    return (ctx, next) => {
      return new Promise(function (resolve, reject) {
        less.apply(null , options)(ctx.req, ctx.res , (error) =>{
          if(error){
            reject(error);
          }else{
            resolve();
          }
        });
      }).then(()=>{
        return next();
      })
      
    }
};