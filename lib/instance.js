const JsonPointer = require("@hyperjump/json-pointer");
const curry = require("just-curry-it");
const { splitUrl } = require("./common");


const nil = Object.freeze({ pointer: "", instance: undefined });
const cons = (instance) => Object.freeze({ ...nil, instance });
const get = (url, contextDoc = nil) => Object.freeze({ ...contextDoc, pointer: splitUrl(url)[1] });
const uri = (doc) => `#${encodeURI(doc.pointer)}`;
const value = (doc) => JsonPointer.get(doc.pointer, doc.instance);

const step = (key, doc) => {
  const keyPointer = JsonPointer.append(key, doc.pointer);
  return get(`#${encodeURI(keyPointer)}`, doc);
};

const entries = (doc) => Object.keys(value(doc))
  .map((key) => [key, step(key, doc)]);

const map = curry((fn, doc) => value(doc)
  .map((item, ndx) => fn(step(ndx, doc), ndx)));

const reduce = curry((fn, acc, doc) => value(doc)
  .reduce((acc, item, ndx) => fn(acc, step(ndx, doc), ndx), acc));

const every = curry((fn, doc) => Object.keys(value(doc))
  .every((key, ndx) => fn(step(key, doc), ndx)));

const some = curry((fn, doc) => Object.keys(value(doc))
  .some((key, ndx) => fn(step(key, doc), ndx)));

module.exports = { cons, get, uri, value, step, entries, map, reduce, every, some };
