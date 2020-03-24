const contentTypeParser = require("content-type");
const curry = require("just-curry-it");
const resolveUrl = require("./url-resolve-browser");
const JsonPointer = require("@hyperjump/json-pointer");
const { isObject, splitUrl } = require("./common");
const fetch = require("./fetch");


const internalJref = Symbol("$__jref");

// Config
const config = {};
const configAlias = {};

const setConfig = (schemaVersion, key, value) => {
  if (!config[schemaVersion]) {
    config[schemaVersion] = {};
  }
  config[schemaVersion][key] = value;
};

const getConfig = (schemaVersion, key) => {
  const configVersion = schemaVersion in configAlias ? configAlias[schemaVersion] : schemaVersion;
  if (configVersion in config) {
    return config[configVersion][key];
  }
};

// Schema Management
const schemaStore = {};

const add = (schema, url = "", defaultSchemaVersion = "") => {
  // Schema Version
  const schemaVersion = splitUrl(schema["$schema"] || defaultSchemaVersion)[0];
  if (!schemaVersion) {
    throw Error("Couldn't determine schema version");
  }
  delete schema["$schema"];

  // Identifier
  const idToken = getConfig(schemaVersion, "idToken");
  const id = splitUrl(url || schema[idToken] || "")[0];
  if (!id) {
    throw Error("Couldn't determine an identifier for the schema");
  }

  // Recursive Anchor
  const recursiveAnchor = !!schema["$recursiveAnchor"];
  delete schema["$recursiveAnchor"];

  // Vocabulary
  let vocabulary;
  if (getConfig(schemaVersion, "vocabulary") && isObject(schema) && "$vocabulary" in schema) {
    configAlias[id] = schemaVersion;
    vocabulary = schema["$vocabulary"];
    delete schema["$vocabulary"];
  } else if (id === schemaVersion) {
    vocabulary = { [schemaVersion]: true };
  } else {
    vocabulary = {};
  }

  // Store Schema
  const anchors = {};
  schemaStore[id] = {
    schemaVersion: schemaVersion,
    schema: processSchema(schema, id, schemaVersion, JsonPointer.nil, anchors),
    anchors: anchors,
    recursiveAnchor: recursiveAnchor,
    vocabulary: vocabulary,
    validated: false
  };
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

const markValidated = (id) => {
  schemaStore[id].validated = true;
};

// Schema Retrieval
const nil = Object.freeze({ id: "http://", schemaVersion: undefined, pointer: "", schema: undefined, recursiveAnchor: false });

const get = async (url, contextDoc = nil, recursive = false) => {
  const contextUrl = recursive && contextDoc.recursiveAnchor ? contextDoc.recursiveAnchor : uri(contextDoc);
  const resolvedUrl = safeResolveUrl(contextUrl, url);
  const [id, fragment] = splitUrl(resolvedUrl);

  if (!(id in schemaStore)) {
    const response = await fetch(id, { headers: { Accept: "application/schema+json" } });
    if (response.status >= 400) {
      throw Error(`Failed to retrieve schema with id: ${id}`);
    }

    if (response.headers.has("content-type")) {
      const contentType = contentTypeParser.parse(response.headers.get("content-type")).type;
      if (contentType !== "application/schema+json") {
        throw Error(`${id} is not a schema. Found a document with media type: ${contentType}`);
      }
    }

    add(await response.json(), id);
  }

  const doc = Object.freeze({
    id: id,
    schemaVersion: schemaStore[id].schemaVersion,
    vocabulary: schemaStore[id].vocabulary,
    pointer: fragment && fragment[0] !== "/" ? getAnchorPointer(id, fragment) : fragment,
    schema: schemaStore[id].schema,
    recursiveAnchor: contextDoc.recursiveAnchor || (schemaStore[id].recursiveAnchor ? id : false),
    validated: schemaStore[id].validated
  });

  // Follow references
  const docValue = value(doc);
  if (isObject(docValue) && internalJref in docValue) {
    return get(docValue[internalJref], doc);
  } else if (getConfig(doc.schemaVersion, "jsonReference") && isObject(docValue) && typeof docValue["$ref"] === "string") {
    return get(docValue["$ref"], doc);
  } else if (getConfig(doc.schemaVersion, "keywordReference") && typeof docValue === "string" && doc.pointer.endsWith("/$ref")) {
    return get(docValue, doc);
  } else if (getConfig(doc.schemaVersion, "keywordRecursiveReference") && typeof docValue === "string" && doc.pointer.endsWith("/$recursiveRef")) {
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

const getAnchorPointer = (id, fragment) => {
  if (!(fragment in schemaStore[id].anchors)) {
    throw Error(`No such anchor '${encodeURI(id)}#${encodeURI(fragment)}'`);
  }

  return schemaStore[id].anchors[fragment];
};

// Utility Functions
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

module.exports = {
  setConfig, getConfig,
  add, get, markValidated,
  uri, value, step, sibling, entries, map
};
