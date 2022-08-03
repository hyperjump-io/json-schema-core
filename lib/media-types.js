const contentTypeParser = require("content-type");


const mediaTypePlugins = {};

const addPlugin = (contentType, plugin) => {
  mediaTypePlugins[contentType] = plugin;
};

const parse = (response) => {
  const contentType = contentTypeParser.parse(response.headers.get("content-type"));
  if (!(contentType.type in mediaTypePlugins)) {
    throw Error(`${response.url} is not a schema. Found a document with media type: ${contentType.type}`);
  }
  return mediaTypePlugins[contentType.type].parse(response, contentType.parameters);
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
