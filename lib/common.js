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

module.exports = { jsonTypeOf, splitUrl };
