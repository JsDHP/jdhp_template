{   
  "cookies": {
    "JSONencode": true
  },
  "content-security-policy": { // Do "content-security-policy": false if you really need to disable it. 
    "default-src": ['self'], // Another option, if you want to disable/change the csp for a single file, use response.csp({ "default-src": ['self'] }) or response.csp(false) note that, for the first usage response.csp({ ... }), it modifies the global csp. I.E: { ...globalCSP, ...yourInput }.
  }
}