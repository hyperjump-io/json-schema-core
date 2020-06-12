const contentTypeParser = require("content-type");
const curry = require("just-curry-it");
const Pact = require("@hyperjump/pact");
const JsonPointer = require("@hyperjump/json-pointer");
const resolveUrl = require("url-resolve-browser");
const { jsonTypeOf, splitUrl } = require("./common");
const fetch = require("./fetch");
const Reference = require("./reference");


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
const schemaStoreAlias = {};

const add = (schema, url = "", defaultSchemaVersion = "") => {
  schema = JSON.parse(JSON.stringify(schema));

  // Schema Version
  const schemaVersion = splitUrl(schema["$schema"] || defaultSchemaVersion)[0];
  if (!schemaVersion) {
    throw Error("Couldn't determine schema version");
  }
  delete schema["$schema"];

  // Identifier
  const idToken = getConfig(schemaVersion, "idToken");
  const anchorToken = getConfig(schemaVersion, "anchorToken");
  const externalId = splitUrl(url)[0];
  if (!externalId && !splitUrl(schema[idToken] || "")[0]) {
    throw Error("Couldn't determine an identifier for the schema");
  }
  const internalUrl = safeResolveUrl(externalId, schema[idToken] || "");
  const [id, fragment] = splitUrl(internalUrl);
  delete schema[idToken];
  if (fragment && idToken === anchorToken) {
    schema[anchorToken] = anchorToken !== idToken ? encodeURI(fragment) : `#${encodeURI(fragment)}`;
  }
  if (externalId) {
    schemaStoreAlias[externalId] = id;
  }

  // recursiveAnchor
  const recursiveAnchors = {};
  const recursiveAnchorToken = getConfig(schemaVersion, "recursiveAnchorToken");
  if (schema[recursiveAnchorToken] === true) {
    recursiveAnchors["#"] = id;
    schema[anchorToken] = "";
    delete schema[recursiveAnchorToken];
  }

  // Vocabulary
  let vocabulary;
  if (getConfig(schemaVersion, "vocabulary") && jsonTypeOf(schema, "object") && "$vocabulary" in schema) {
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
    id: id,
    schemaVersion: schemaVersion,
    schema: processSchema(schema, id, schemaVersion, JsonPointer.nil, anchors, recursiveAnchors),
    anchors: anchors,
    recursiveAnchors: recursiveAnchors,
    vocabulary: vocabulary,
    validated: false
  };
};

const processSchema = (subject, id, schemaVersion, pointer, anchors, recursiveAnchors) => {
  if (jsonTypeOf(subject, "object")) {
    const embeddedSchemaVersion = typeof subject["$schema"] === "string" ? subject["$schema"] : schemaVersion;
    const embeddedIdToken = getConfig(embeddedSchemaVersion, "idToken");
    const embeddedAnchorToken = getConfig(embeddedSchemaVersion, "anchorToken");
    if (typeof subject[embeddedIdToken] === "string" && (embeddedIdToken !== embeddedAnchorToken || subject[embeddedIdToken][0] !== "#")) {
      const ref = safeResolveUrl(id, subject[embeddedIdToken]);
      subject[embeddedIdToken] = ref;
      add(subject, ref, schemaVersion);
      return Reference.cons(subject[embeddedIdToken], subject);
    }

    const anchorToken = getConfig(schemaVersion, "anchorToken");
    const dynamicAnchorToken = getConfig(schemaVersion, "dynamicAnchorToken");
    if (typeof subject[dynamicAnchorToken] === "string") {
      recursiveAnchors[`#${subject[dynamicAnchorToken]}`] = id;
      subject[anchorToken] = subject[dynamicAnchorToken];
      delete subject[dynamicAnchorToken];
    }

    const idToken = getConfig(schemaVersion, "idToken");
    if (typeof subject[anchorToken] === "string") {
      const anchor = anchorToken !== idToken ? subject[anchorToken] : subject[anchorToken].slice(1);
      anchors[anchor] = pointer;
      delete subject[anchorToken];
    }

    const jrefToken = getConfig(schemaVersion, "jrefToken");
    if (typeof subject[jrefToken] === "string") {
      return Reference.cons(subject[jrefToken], subject);
    }

    subject = Object.entries(subject)
      .reduce((acc, [key, value]) => {
        acc[key] = processSchema(value, id, schemaVersion, JsonPointer.append(key, pointer), anchors, recursiveAnchors);
        return acc;
      }, {});

    const jsrefToken = getConfig(schemaVersion, "jsrefToken");
    if (typeof subject[jsrefToken] === "string") {
      subject[jsrefToken] = Reference.cons(subject[jsrefToken], subject[jsrefToken]);
    }

    const dynamicJsrefToken = getConfig(schemaVersion, "dynamicJsrefToken");
    if (typeof subject[dynamicJsrefToken] === "string") {
      subject[dynamicJsrefToken] = Reference.cons(subject[dynamicJsrefToken], subject[dynamicJsrefToken], true);
    }

    return subject;
  } else if (Array.isArray(subject)) {
    return subject.map((item, ndx) => processSchema(item, id, schemaVersion, JsonPointer.append(ndx, pointer), anchors, recursiveAnchors));
  } else {
    return subject;
  }
};

const hasStoredSchema = (id) => id in schemaStore || id in schemaStoreAlias;
const getStoredSchema = (id) => schemaStore[schemaStoreAlias[id]] || schemaStore[id];

const markValidated = (id) => {
  schemaStore[id].validated = true;
};

// Schema Retrieval
const nil = Object.freeze({ id: "", schemaVersion: undefined, pointer: "", schema: undefined, recursiveAnchors: {} });

const get = async (url, contextDoc = nil, recursive = false) => {
  const contextUrl = recursive && contextDoc.recursiveAnchors[url] ? contextDoc.recursiveAnchors[url] : uri(contextDoc);
  const resolvedUrl = safeResolveUrl(contextUrl, url);
  const [id, fragment] = splitUrl(resolvedUrl);

  if (!hasStoredSchema(id)) {
    const response = await fetch(id, { headers: { Accept: "application/schema+json" } });
    if (response.status >= 400) {
      await response.text(); // Sometimes node hangs without this hack
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

  const storedSchema = getStoredSchema(id);
  const pointer = fragment && fragment[0] !== "/" ? getAnchorPointer(storedSchema, fragment) : fragment;
  const doc = Object.freeze({
    id: storedSchema.id,
    schemaVersion: storedSchema.schemaVersion,
    vocabulary: storedSchema.vocabulary,
    pointer: pointer,
    schema: storedSchema.schema,
    value: JsonPointer.get(pointer, storedSchema.schema),
    recursiveAnchors: { ...storedSchema.recursiveAnchors, ...contextDoc.recursiveAnchors },
    validated: storedSchema.validated
  });

  return followReferences(doc);
};

const followReferences = (doc) => Reference.isReference(doc.value) ? get(Reference.href(doc.value), doc, Reference.isDynamic(doc.value)) : doc;

const safeResolveUrl = (contextUrl, url) => {
  const resolvedUrl = resolveUrl(contextUrl, url);
  const contextId = splitUrl(contextUrl)[0];
  if (contextId && getScheme(resolvedUrl) === "file" && getScheme(contextId) !== "file") {
    throw Error(`Can't access file '${resolvedUrl}' resource from network context '${contextUrl}'`);
  }
  return resolvedUrl;
};

const getScheme = (url) => {
  const matches = url.match(/^(.+):\/\//);
  return matches ? matches[1] : "";
};

const getAnchorPointer = (storedSchema, fragment) => {
  if (!(fragment in storedSchema.anchors)) {
    throw Error(`No such anchor '${encodeURI(storedSchema.id)}#${encodeURI(fragment)}'`);
  }

  return storedSchema.anchors[fragment];
};

// Utility Functions
const uri = (doc) => `${doc.id}#${encodeURI(doc.pointer)}`;
const value = (doc) => Reference.isReference(doc.value) ? Reference.value(doc.value) : doc.value;
const has = (key, doc) => key in value(doc);
const typeOf = (doc, type) => jsonTypeOf(value(doc), type);

const step = (key, doc) => {
  const storedSchema = getStoredSchema(doc.id);
  const nextDoc = Object.freeze({
    id: doc.id,
    schemaVersion: doc.schemaVersion,
    vocabulary: doc.vocabulary,
    pointer: JsonPointer.append(key, doc.pointer),
    schema: storedSchema.schema,
    value: value(doc)[key],
    recursiveAnchors: doc.recursiveAnchors,
    validated: storedSchema.validated
  });
  return followReferences(nextDoc);
};

const keys = (doc) => Object.keys(value(doc));

const entries = (doc) => Pact.pipeline([
  value,
  Object.keys,
  Pact.map(async (key) => [key, await step(key, doc)]),
  Pact.all
], doc);

const map = curry((fn, doc) => Pact.pipeline([
  value,
  Pact.map(async (item, ndx) => fn(await step(ndx, doc), ndx)),
  Pact.all
], doc));

const length = (doc) => value(doc).length;

module.exports = {
  setConfig, getConfig,
  add, get, markValidated,
  uri, value, typeOf, has, step, keys, entries, map, length
};
