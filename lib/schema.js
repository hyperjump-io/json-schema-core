const contentTypeParser = require("content-type");
const curry = require("just-curry-it");
const Pact = require("@hyperjump/pact");
const JsonPointer = require("@hyperjump/json-pointer");
const resolveUrl = require("./url-resolve-browser");
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
  const externalId = splitUrl(url)[0];
  if (!externalId && !splitUrl(schema[idToken] || "")[0]) {
    throw Error("Couldn't determine an identifier for the schema");
  }
  const internalUrl = safeResolveUrl(externalId, schema[idToken] || "");
  const id = splitUrl(internalUrl)[0];
  if (externalId) {
    schemaStoreAlias[externalId] = id;
  }

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
  const recursiveAnchors = {};
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
  if (isObject(subject)) {
    const idToken = getConfig(schemaVersion, "idToken");
    const anchorToken = getConfig(schemaVersion, "anchorToken");

    if (typeof subject[idToken] === "string") {
      const ref = subject[idToken];
      const resolvedUrl = safeResolveUrl(id, ref);
      const [schemaId, fragment] = splitUrl(resolvedUrl);
      delete subject[idToken];

      if (fragment && idToken === anchorToken) {
        subject[anchorToken] = anchorToken !== idToken ? encodeURI(fragment) : `#${encodeURI(fragment)}`;
      }

      if (schemaId !== id) {
        add(subject, safeResolveUrl(id, schemaId), schemaVersion);
        return { [internalJref]: ref };
      }
    }

    if (getConfig(schemaVersion, "recursiveAnchorType") === "string") {
      if (typeof subject["$recursiveAnchor"] === "string") {
        recursiveAnchors[`#${subject["$recursiveAnchor"]}`] = id;
        subject[anchorToken] = subject["$recursiveAnchor"];
        delete subject["$recursiveAnchor"];
      }
    } else {
      if (pointer === JsonPointer.nil && subject["$recursiveAnchor"] === true) {
        recursiveAnchors["#"] = id;
        delete subject["$recursiveAnchor"];
      }
    }


    if (typeof subject[anchorToken] === "string") {
      const anchor = anchorToken !== idToken ? subject[anchorToken] : subject[anchorToken].slice(1);
      anchors[anchor] = pointer;
      delete subject[anchorToken];
    }

    return Object.entries(subject)
      .reduce((acc, [key, value]) => {
        acc[key] = processSchema(value, id, schemaVersion, JsonPointer.append(key, pointer), anchors, recursiveAnchors);
        return acc;
      }, {});
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
  const doc = Object.freeze({
    id: storedSchema.id,
    schemaVersion: storedSchema.schemaVersion,
    vocabulary: storedSchema.vocabulary,
    pointer: fragment && fragment[0] !== "/" ? getAnchorPointer(storedSchema, fragment) : fragment,
    schema: storedSchema.schema,
    recursiveAnchors: { ...storedSchema.recursiveAnchors, ...contextDoc.recursiveAnchors },
    validated: storedSchema.validated
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
const value = (doc) => JsonPointer.get(doc.pointer, doc.schema);
const has = (key, doc) => key in value(doc);

const step = (key, doc) => {
  const keyPointer = JsonPointer.append(key, doc.pointer);
  return get(`#${encodeURI(keyPointer)}`, doc);
};

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

module.exports = {
  setConfig, getConfig,
  add, get, markValidated,
  uri, value, has, step, entries, map
};
