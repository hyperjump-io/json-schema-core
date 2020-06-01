const JsonPointer = require("@hyperjump/json-pointer");
const curry = require("just-curry-it");
const { internalValue } = require("./common");


const nil = Object.freeze({ id: "", pointer: "", instance: undefined, value: undefined });
const cons = (instance, id = "") => Object.freeze({ ...nil, id, instance, value: instance });
const uri = (doc) => `${doc.id}#${encodeURI(doc.pointer)}`;
const value = (doc) => (doc.value && doc.value[internalValue]) ? doc.value[internalValue] : doc.value;

const step = (key, doc) => Object.freeze({
  ...doc,
  pointer: JsonPointer.append(key, doc.pointer),
  value: doc.value[key]
});

const entries = (doc) => Object.keys(value(doc))
  .map((key) => [key, step(key, doc)]);

const map = curry((fn, doc) => value(doc)
  .map((item, ndx) => fn(step(ndx, doc), ndx)));

const filter = curry((fn, doc) => value(doc)
  .map((item, ndx) => step(ndx, doc))
  .filter((item, ndx) => fn(item, ndx)));

const reduce = curry((fn, acc, doc) => value(doc)
  .reduce((acc, item, ndx) => fn(acc, step(ndx, doc), ndx), acc));

const every = curry((fn, doc) => Object.keys(value(doc))
  .every((key, ndx) => fn(step(key, doc), ndx)));

const some = curry((fn, doc) => Object.keys(value(doc))
  .some((key, ndx) => fn(step(key, doc), ndx)));

module.exports = { cons, uri, value, step, entries, map, filter, reduce, every, some };
