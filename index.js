assertMethodIs('GET')

let document = createDocument();

document.body.add('b', {
  children: [{
    tag: 'a',
    content: 'Link',
    href: 'https://google.com'
  }]
})

document.title = "Hello!!!";

document.addScript(function () {
  console.log("nonces, baby!!!!")
}, "body")

document.css(`body {
  font-family: arial;
  padding: 10px
}`)

response.csp({
  "default-src": ['self', 'https://example.com']
})

response.finish()