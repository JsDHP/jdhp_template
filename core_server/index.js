console.log('\nStarting server...\n')

const cookieParser  = require('cookie-parser');
const makeWindow         = require("./window");
const collaspe         = require("./collaspe");
const express             = require("express");
const path                   = require('path');
const config = require(path.join(process.cwd(),
                          'jdhp.config.json'));
const pkgjsn = require(path.join(process.cwd(),
                              'package.json'));
const vm                  = require('node:vm');
const fs                       = require('fs');
const crypto               = require('crypto');

function rh(s, f) {
  crypto.randomBytes(s, function (err, buffer) {
    if (err) {
      throw err
    }
    f(buffer.toString('hex'))
  })
}

function cast(def) {
  Object.keys(def).forEach(k=>{
    if (config[k] === undefined) {
      config[k] = def[k]
    }
  })
}

cast({
  "cookies": {
    "JSONencode": true
  },
  "global": {},
  "content-security-policy": {
    "default": ['self']
  },
  "extentions": []
})

const app = express();
app.use(cookieParser())

function toCSPString(obj) {
  if (obj === false) {
    return false
  }
  let out = '';
  Object.entries(obj).forEach(([ key, value ])=>{
    if (value === true) {
      return out+=`${key} ${value.join(' ')}; `
    }
    out+=`${key} ${value.join(' ')}; `
  })
  return out.slice(0, -1)
}

function registerJS(path, callback) {
  app.all(path, function (req, res) {
    let fileConsole = new Proxy(console,{get:function(console, name){if(console[name]===undefined){return}return function (...args) {
      process.stdout.write(`${name.toUpperCase()} AT ${path}: `)
      console[name](...args)
    }}});
      rh(16, function (nonce) {
        try {

        let contentType;
        let createdDocument;
        let url = new URL(req.url, 'https://google.com');
        let cookieJar = Object(req.cookies);
        let usedSend = '';
        let baseCSP = JSON.parse(JSON.stringify(config["content-security-policy"]));
        
        baseCSP['script-src'] = baseCSP['script-src'] || [];
        baseCSP['script-src'].push(`'nonce-${nonce}'`)
        
        let CSP = toCSPString(baseCSP);
        
        res.setHeader('x-powered-by', 'JDHP')
        res.setHeader('x-server-version', pkgjsn.version);
        callback({
          method: req.method,
          assertMethodIs(...args) {
            args = args.map(arg=>arg.toUpperCase())

            if (!args.includes(req.method)) {
              throw Error(`MethodError:${req.method}`)
            }
          },
          createDocument(startingContent) {
            if (createdDocument) {
              throw Error("Cannot create even more documents.")
            } 
            if (usedSend) {
              throw Error("Cannot combine createDocument and response.write().")
            }
            createdDocument = makeWindow(path, startingContent);
            return createdDocument
          },
          console: fileConsole,
          location: {
            password: url.password,
            pathname: url.pathname,
            search: url.search,
            searchParams: url.searchParams,
            hash: url.hash,
            urlParameters: req.params
          },
          cookies: {
            get: function (item) {
              return cookieJar[item]
            },
            set: function (item, value) {
              res.cookie(item, cookieJar[item] = value)
            },
            delete: function (item) {
              res.clearCookie(item);
              delete cookieJar[item]
            },
            getAll: function () {
              return Object.entries(cookieJar).map(([name, value])=>{
                return {
                  name,
                  value
                }
              })
            }
          },
          response: {
            status: function (status) {
              res.status(status)
            },
            write: function (data) {
              if (createdDocument) {
                throw Error("Cannot combine createDocument and response.write().")
              }
              if (contentType === undefined) {
                contentType = 'text/plain'
              }
              if (!usedSend) {
                res.type(contentType || 'text/plain')
                res.set("Content-Security-Policy", CSP);
              }

              usedSend = true;
              res.write(data)
            },
            headers(...a) {
              if (a.length < 2) {
                Object.entries(a[0]).forEach(([header, content])=>{
                  res.setHeader(header, content)
                })
              }
            },
            contentType(contenttype) {
              contentType = contenttype
            },
            csp(csp) {
              if (csp === false) {
                CSP = csp;
                return
              }
              csp = {
                ...baseCSP,
                ...csp
              }
              if (!csp['script-src'].includes(`'nonce-${nonce}'`)) {
                baseCSP['script-src'] = baseCSP['script-src'] || [];
                baseCSP['script-src'].push(`'nonce-${nonce}'`) 
              }
              CSP = toCSPString(csp)
            },
            finish: function () {
              if (createdDocument === undefined) {
                return res.end()
              }
        
              let data = createdDocument[makeWindow.finishSymbol](function (...args) {
                args.forEach(script=>{
                  script.setAttribute('nonce', nonce)
                })
              });
        
              if (contentType === undefined) {
                contentType = 'text/html'
              }
              res.type(contentType)
              if (CSP) {
                res.set("Content-Security-Policy", CSP);
              }
              res.send(data)    
            }
          },
          global: config.global,
          config: config
          })
          } catch (e) {
      if (e.message.startsWith('MethodError:')) {
        res.status(405)
        res.setHeader("Content-Security-Policy", toCSPString({
          "default-src": []
        }));
        res.type('text/plain')
        res.send(`Method Not Allowed: ${e.message.split(/:/)[1]}`)
      } else {
        res.status(500)
        fileConsole.error(e)
        res.setHeader("Content-Security-Policy", toCSPString({
          "default-src": []
        }));
        res.type('text/plain')
        res.send(e.toString())
      }
    }
        })
  });
}
function serve(contentType, path, content) {
  app.get(path, function (req, res) {
    res.type(contentType);
    res.setHeader("Content-Security-Policy", toCSPString(config['content-security-policy']));
    res.send(content);
  });
}

Object.entries(collaspe('extentions')).forEach(([ file, content ])=>{
  if (!file.endsWith('.js')) {
    return
  }
  let fileContent = content.toString();
  vm.runInContext(fileContent, vm.createContext({
    server: {
      serveJS: registerJS,
      serveContent: function ({ contentType, path, content }) {
        if (contentType === undefined) {
          contentType = path;
        }
        return serve(contentType, path, content)
      },
      core: app,
      config: config
    },
    
    global: config.global,

    console: new Proxy(console,{get:function(console, name){if(console[name]===undefined){return}return function (...args) {
      process.stdout.write(`EXT ${file}: `)
      console[name](...args)
    }}})
  }))
})

Object.entries(collaspe()).forEach(([ file, content ])=>{
  console.log("Loading", file)
  if (file.endsWith('.js')) {
    let fileContent = content.toString();
    let path = '/'+file.slice(0, -3);
    if (file.endsWith('/index.js') || file === 'index.js') {
      path = '/'+(file.split('/').slice(0, -1).join('/'))+'/'
      if (path === '//') {
        path = '/'
      }
    }
    registerJS(path, function (window) {
      vm.runInContext(fileContent, vm.createContext(window))
    })
  } else {
    serve(file, '/'+file, content)
  }
});

app.listen(8080, function () {
  console.log('\nServer Up!\n')
})
