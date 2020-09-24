const fs = require("fs");
const fetch = require("node-fetch");


module.exports = (url, options) => {
  if (url.startsWith("file://")) {
    const path = url.match(/file:\/\/(.+)/)[1];
    const stream = fs.createReadStream(path);
    return new fetch.Response(stream);
  } else {
    return fetch(url, options);
  }
};
