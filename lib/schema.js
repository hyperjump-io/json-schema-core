const resolveUrl = require("./url-resolve-browser");
const curry = require("just-curry-it");
const JsonPointer = require("@hyperjump/json-pointer");
const { isObject, splitUrl } = require("./common");
const fetch = require("./fetch");


const internalJref = Symbol("$__jref");
const config = {};
const setConfig = (schemaVersion, key, value) => {
  if (!config[schemaVersion]) {
    config[schemaVersion] = {};
  }
  config[schemaVersion][key] = value;
};
const getConfig = (schemaVersion, key) => {
  if (schemaVersion in config) {
    return config[schemaVersion][key];
  }
};

const schemaStore = {};

const add = (schema, url = "", defaultSchemaVersion = "") => {
  const schemaVersion = splitUrl(schema["$schema"] || defaultSchemaVersion)[0];
  if (!schemaVersion) {
    throw Error("Couldn't determine schema version");
  }
  delete schema["$schema"];

  const idToken = getConfig(schemaVersion, "idToken");
  const id = splitUrl(url || schema[idToken] || "")[0];
  if (!id) {
    throw Error("Couldn't determine an identifier for the schema");
  }

  const anchors = {};
  schemaStore[id] = {
    schemaVersion: schemaVersion,
    schema: processSchema(schema, id, schemaVersion, JsonPointer.nil, anchors),
    anchors: anchors,
    recursiveAnchor: !!schema["$recursiveAnchor"],
    validated: false
  };
};

const markValidated = (id) => {
  schemaStore[id].validated = true;
};

const processSchema = (subject, id, schemaVersion, pointer, anchors) => {
  if (isObject(subject)) {
    const idToken = getConfig(schemaVersion, "idToken");
    const anchorToken = getConfig(schemaVersion, "anchorToken");

    if (typeof subject[idToken] === "string") {
      const ref = subject[idToken];
      const resolvedUrl = safeResolveUrl(id, ref);
      const [schemaId, fragment] = splitUrl(resolvedUrl);
      delete subject[idToken];

      if (fragment) {
        subject[anchorToken] = anchorToken !== idToken ? encodeURI(fragment) : `#${encodeURI(fragment)}`;
      }

      if (schemaId !== id) {
        add(subject, safeResolveUrl(id, schemaId), schemaVersion);
        return { [internalJref]: ref };
      }
    }

    if (typeof subject[anchorToken] === "string") {
      const anchor = anchorToken !== idToken ? subject[anchorToken] : subject[anchorToken].slice(1);
      anchors[anchor] = pointer;
      delete subject[anchorToken];
    }

    return Object.entries(subject)
      .reduce((acc, [key, value]) => {
        acc[key] = processSchema(value, id, schemaVersion, JsonPointer.append(key, pointer), anchors);
        return acc;
      }, {});
  } else if (Array.isArray(subject)) {
    return subject.map((item, ndx) => processSchema(item, id, schemaVersion, JsonPointer.append(ndx, pointer), anchors));
  } else {
    return subject;
  }
};

const nil = Object.freeze({ id: "http://", schemaVersion: undefined, pointer: "", schema: undefined, recursiveAnchor: false });

const get = async (url, contextDoc = nil, recursive = false) => {
  const contextUrl = recursive && contextDoc.recursiveAnchor ? contextDoc.recursiveAnchor : uri(contextDoc);
  const resolvedUrl = safeResolveUrl(contextUrl, url);
  const [id, fragment] = splitUrl(resolvedUrl);

  if (!(id in schemaStore)) {
    const response = await fetch(id);
    add(await response.json(), id);
  }

  const pointer = fragment && fragment[0] !== "/" ? schemaStore[id].anchors[fragment] : fragment;
  const doc = Object.freeze({
    id: id,
    schemaVersion: schemaStore[id].schemaVersion,
    pointer: pointer,
    schema: schemaStore[id].schema,
    recursiveAnchor: contextDoc.recursiveAnchor || (schemaStore[id].recursiveAnchor ? id : false),
    validated: schemaStore[id].validated
  });

  // Follow references
  const docValue = value(doc);
  if (isObject(docValue) && internalJref in docValue) {
    return get(docValue[internalJref], doc);
  } else if (config[doc.schemaVersion].jsonReference && isObject(docValue) && typeof docValue["$ref"] === "string") {
    return get(docValue["$ref"], doc);
  } else if (config[doc.schemaVersion].keywordReference && typeof docValue === "string" && doc.pointer.endsWith("/$ref")) {
    return get(docValue, doc);
  } else if (config[doc.schemaVersion].keywordRecursiveReference && typeof docValue === "string" && doc.pointer.endsWith("/$recursiveRef")) {
    return get(docValue, doc, true);
  } else {
    return doc;
  }
};

const safeResolveUrl = (contextUrl, url) => {
  const resolvedUrl = resolveUrl(contextUrl, url);
  if (getScheme(resolvedUrl) === "file" && getScheme(contextUrl) !== "file") {
    throw Error("Can't access file resource from network context");
  }
  return resolvedUrl;
};

const getScheme = (url) => {
  const matches = url.match(/(.+):\/\//)[1];
  return matches ? matches[1] : "";
};

const uri = (doc) => `${doc.id}#${encodeURI(doc.pointer)}`;
const value = (doc) => JsonPointer.get(doc.pointer, doc.schema);

const step = (key, doc) => {
  const keyPointer = JsonPointer.append(key, doc.pointer);
  return get(`#${encodeURI(keyPointer)}`, doc);
};

const sibling = (key, doc) => {
  const segments = doc.pointer.split("/");
  segments.pop();
  const keyPointer = JsonPointer.append(key, segments.join("/"));
  return get(`#${encodeURI(keyPointer)}`, doc);
};

const entries = (doc) => Object.keys(value(doc))
  .map((key) => [key, step(key, doc)]);

const map = curry((fn, doc) => value(doc)
  .map(async (item, ndx) => fn(await step(ndx, doc), ndx)));

module.exports = { setConfig, add, get, markValidated, uri, value, step, sibling, entries, map };
