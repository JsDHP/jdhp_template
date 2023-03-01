const jsdom = require("jsdom");
const { JSDOM } = jsdom;
/*let Document = (new JSDOM('')).window.document.__proto__.__proto__;
class MyDocument extends Document {
  #scriptHead;
  #scriptBody
  constructor(...args) {
    super(...args)
    this.
  }
}
(new JSDOM('')).window.document.__proto__ = MyDocument*/
function fetchWindowProp(p) {
  return (new JSDOM('', {
    runScripts: 'outside-only'
  })).window.eval(p)
}
function escape(s) {
  let lookup = {
    '&': "&amp;",
    '"': "&quot;",
    "'": "&apos;",
    '<': "&lt;",
    '>': "&gt;"
  };
  return s.replace(/[&"'<>]/g, c=>lookup[c]);
}
function makeElement(document, name, options) {
  options = {
    HTML: '',
    ...options
  }
  let elem = document.createElement(name)

  if (options.style) {
    if (typeof options.style !== 'string') {
      let newStyle = ''
      Object.keys(options.style).forEach(p=>{
        newStyle += `${p}:${options.style[p]};`
      })
    }
  }
  if (options.children !== undefined) {
    options.children.forEach(child=>{
      if (typeof child === 'string') {
        return elem.appendChild(document.createTextNode(child))
      }
      let name = child.tag;
      delete child.tag;
      elem.appendChild(makeElement(document, name, child))
    })
  } else if (options.text || options.content) {
    let text = options.text || options.content;
    elem.innerHTML = escape(text)
  } else {
    elem.innerHTML = options.HTML
  }
  delete options.children;
  delete options.HTML;
  delete options.text;
  delete options.content;
  
  Object.keys(options).forEach(k=>{
    elem.setAttribute(k, options[k])
  })

  return elem
}

function urlResolve(...args) {
  if (args.length === 0) {
    return '/'
  }
  if (args.length === 1) {
    return (new URL(args[0], 'https://google.com')).pathname
  }
  if (args.length === 2) {
    return (new URL(args[1], new URL(args[0], 'https://google.com'))).pathname
  }
  let curr = urlResolve(args[0], args[1]);
  for (let i = 2; i < args.length; i++) {
    curr = urlResolve(curr, args[i])
  }
  return curr
}

function makeWindow(path, content='<!DOCTYPE html><html lang="en"></html>') {
  let dom = new JSDOM(content)
  let document = dom.window.document;
  let scriptHead = document.createElement('script');
  let scriptBody = document.createElement('script');

  document.addScript = function (func, target, ...args) {
    // Target is head or body
    target = target.toLowerCase();
    if (target === 'head') {
      target = scriptHead
    } else if (target === 'body') {
      target = scriptBody
    } else {
      throw Error(`Target must be "head" or "body", but it was ${JSON.stringify(target)}.`)
    }
    target.innerHTML+=`(${func.toString()})(${args.map(e=>JSON.stringify(e)).join(',')});`
  }

  document.inlineCss = function (css) {
    document.head.add('style', {
      HTML: css
    })
  }

  document.linkCss = function (css) {
    document.head.add('link', {
      rel: "stylesheet",
      href: urlResolve(path, css)
    })
  }

  document.css = function (css) {
    if (css.startsWith('/') || css.startsWith('./')) {
      return document.linkCss(css)
    }
    return document.inlineCss(css)
  }

  document.element = function (name, options) {
    return makeElement(document, name, options)
  }
  
  document[finishSymbol] = function (callback) {
    document.head.appendChild(scriptHead)
    document.body.appendChild(scriptBody)

    callback(scriptHead, scriptBody)

    return dom.serialize()
  }

  document.body.__proto__.__proto__.__proto__.add = function (name, options) {
    this.appendChild(makeElement(document, name, options))
  }

  document.create = function (name, options) {
    return makeElement(document, name, options)
  }
  
  return document
}

let finishSymbol = Symbol("documentNeedsLoading")

module.exports = makeWindow
module.exports.finishSymbol = finishSymbol;