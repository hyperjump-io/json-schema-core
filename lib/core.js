const PubSub = require("pubsub-js");
const { isObject } = require("./common");
const Instance = require("./instance");
const Schema = require("./schema");


const FLAG = "FLAG", BASIC = "BASIC", DETAILED = "DETAILED", VERBOSE = "VERBOSE";

let metaOutputFormat = DETAILED;

const validate = async (schema, value = undefined, outputFormat = undefined) => {
  const ast = {};
  const schemaUri = await compileSchema(schema, ast);
  const interpret = (value, outputFormat = FLAG) => {
    if (![FLAG, BASIC, DETAILED, VERBOSE].includes(outputFormat)) {
      throw Error(`The '${outputFormat}' error format is not supported`);
    }

    let output = [];
    const subscriptionToken = PubSub.subscribe("result", outputHandler(outputFormat, output));
    interpretSchema(schemaUri, Instance.cons(value), ast);
    PubSub.unsubscribe(subscriptionToken);

    return output[0];
  };

  return value === undefined ? interpret : interpret(value, outputFormat);
};

const outputHandler = (outputFormat, output) => {
  const resultStack = [];

  return (message, keywordResult) => {
    const result = { ...keywordResult, errors: [] };
    while (resultStack.length > 0 && isChild(resultStack[resultStack.length - 1], result)) {
      const topResult = resultStack.pop();
      let errors = [];
      if (outputFormat === BASIC) {
        errors = topResult.errors;
        delete topResult.errors;
      }
      result.errors.unshift(topResult, ...errors);
      if (isRef(result)) {
        break;
      }
    }

    if (outputFormat === VERBOSE || outputFormat !== FLAG && !result.valid) {
      resultStack.push(result);
    }

    output[0] = result;
  };
};

const isChild = (topResult, nextResult) => {
  return topResult.instanceLocation.startsWith(nextResult.instanceLocation)
      && (topResult.absoluteKeywordLocation.startsWith(nextResult.absoluteKeywordLocation)
        || isRef(topResult));
};

const isRef = (result) => result.keyword.endsWith("#$ref") || result.keyword.endsWith("#$recursiveRef");

const setMetaOutputFormat = (format) => {
  metaOutputFormat = format;
};

const _keywords = {};
const getKeyword = (id) => _keywords[id];
const hasKeyword = (id) => id in _keywords;
const addKeyword = (id, handler) => {
  _keywords[id] = handler;
};

const _vocabularies = {};
const defineVocabulary = (id, keywords) => {
  _vocabularies[id] = keywords;
};
const addVocabulary = (schemaVersion, vocabularyId) => {
  Object.entries(_vocabularies[vocabularyId])
    .forEach(([keyword, keywordHandler]) => {
      addKeyword(`${schemaVersion}#${keyword}`, keywordHandler);
    });
};

const metaValidators = {};
const compileSchema = async (schema, ast) => {
  if (!schema.validated) {
    // Determine JSON Schema version
    if (!hasKeyword(`${schema.schemaVersion}#validate`)) {
      throw Error(`Unsupported schema version: ${schema.schemaVersion}`);
    }

    // Meta validation
    if (!isMetaSchema(schema)) {
      if (!(schema.schemaVersion in metaValidators)) {
        const metaSchema = await Schema.get(schema.schemaVersion);
        metaValidators[schema.schemaVersion] = await validate(metaSchema);
      }

      const metaResults = metaValidators[schema.schemaVersion](schema.schema, metaOutputFormat);
      if (!metaResults.valid) {
        throw metaResults;
      }
    }

    Schema.markValidated(schema.id);
  }

  // Compile
  await getKeyword(`${schema.schemaVersion}#validate`).compile(schema, ast);
  return Schema.uri(schema);
};

const isMetaSchema = (schema) => schema.id === schema.schemaVersion || isObject(schema.schema) && "$vocabulary" in schema.schema;

const interpretSchema = (schemaUrl, instance, ast) => {
  const [keywordId] = ast[schemaUrl];
  return getKeyword(keywordId).interpret(schemaUrl, instance, ast);
};

module.exports = {
  validate, setMetaOutputFormat, FLAG, BASIC, DETAILED, VERBOSE,
  addKeyword, getKeyword, hasKeyword, defineVocabulary, addVocabulary,
  compileSchema, interpretSchema
};
