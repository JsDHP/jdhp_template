const path                             = require("path");
const fs                                 = require("fs");
const config = require(path.resolve('jdhp.config.json'));
function collaspe(dir, collasped, slice, hidden) {
  let directory = path.resolve(dir)
  if (slice === undefined) {
    slice = directory.length+1;
  }
  try {
    for (let thing of fs.readdirSync(directory)) {
      let p = path.join(directory, thing)
      if (!hidden.includes(p)) {
        if (fs.statSync(p).isDirectory()) {
          // Is directory
  
          console.log("Reading", p.slice(slice))
          collaspe(p, collasped, slice, hidden)
        } else {
          // Is file
          
          console.log("Reading", p.slice(slice))
          collasped[p.slice(slice)] = fs.readFileSync(p)
        }
      }
    }
  } catch (e) {
    if (e.message.startsWith('ENOENT: no such file or directory')) {
      return {}
    } else {
      throw e
    }
  }

  return collasped
}
let cont = "hidden = []"
try {
  cont = fs.readFileSync('.replit').toString();
} catch {
  
}
const defaultHidden = (JSON.parse(cont.match(/^hidden\s*?=\s*?(\[.*?\])/m)[1].replaceAll("'", '"')).concat(["node_modules", "package.json", "package-lock.json", ".upm", ".replit", "replit.nix", ".cache", "jdhp.config.json", "extentions", ".git", "core_server", ".gitignore", ".config"])).map(e=>{
  return path.join(process.cwd(), e)
});
module.exports = function (directory=process.cwd(), hidden=defaultHidden) {
  hidden = hidden.map(e=>{
    return path.resolve(e)
  })
  let r = collaspe(directory, {}, undefined, hidden);
  return r
}
module.exports.defaultHidden = defaultHidden