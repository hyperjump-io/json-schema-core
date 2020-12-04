const resolveUrl = require("url-resolve-browser");


const isObject = (value) => typeof value === "object" && !Array.isArray(value) && value !== null;
const isType = {
  "null": (value) => value === null,
  "boolean": (value) => typeof value === "boolean",
  "object": isObject,
  "array": (value) => Array.isArray(value),
  "number": (value) => typeof value === "number",
  "integer": (value) => Number.isInteger(value),
  "string": (value) => typeof value === "string"
};
const jsonTypeOf = (value, type) => isType[type](value);

const splitUrl = (url) => {
  const indexOfHash = url.indexOf("#");
  const ndx = indexOfHash === -1 ? url.length : indexOfHash;
  const urlReference = url.slice(0, ndx);
  const urlFragment = url.slice(ndx + 1);

  return [decodeURI(urlReference), decodeURI(urlFragment)];
};

const getScheme = (url) => {
  const matches = url.match(/^(.+):\/\//);
  return matches ? matches[1] : "";
};

const safeResolveUrl = (contextUrl, url) => {
  const resolvedUrl = resolveUrl(contextUrl, url);
  const contextId = splitUrl(contextUrl)[0];
  if (contextId && getScheme(resolvedUrl) === "file" && getScheme(contextId) !== "file") {
    throw Error(`Can't access file '${resolvedUrl}' resource from network context '${contextUrl}'`);
  }
  return resolvedUrl;
};

module.exports = { jsonTypeOf, splitUrl, safeResolveUrl };
