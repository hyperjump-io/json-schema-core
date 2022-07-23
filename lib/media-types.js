const contentTypeParser = require("content-type");


const mediaTypePlugins = {};

const addPlugin = (contentType, plugin) => {
  mediaTypePlugins[contentType] = plugin;
};

const parse = (response) => {
  const contentType = contentTypeParser.parse(response.headers.get("content-type")).type;
  if (!(contentType in mediaTypePlugins)) {
    throw Error(`${response.url} is not a schema. Found a document with media type: ${contentType}`);
  }
  return mediaTypePlugins[contentType].parse(response);
};

const getContentType = (path) => {
  for (const contentType in mediaTypePlugins) {
    if (mediaTypePlugins[contentType].matcher(path)) {
      return contentType;
    }
  }

  return "application/octet-stream";
};

module.exports = { addPlugin, parse, getContentType };
