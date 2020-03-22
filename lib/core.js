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

const _vocabularies = {};
const defineVocabulary = (id, keywords) => {
  _vocabularies[id] = keywords;
};

const metaValidators = {};
const compileSchema = async (schema, ast) => {
  if (!schema.validated) {
    Schema.markValidated(schema.id);

    // Load vocabualries
    Object.entries(schema.vocabulary)
      .forEach(([vocabularyId, isRequired]) => {
        if (vocabularyId in _vocabularies) {
          Object.entries(_vocabularies[vocabularyId])
            .forEach(([keyword, keywordHandler]) => {
              _keywords[`${schema.id}#${keyword}`] = keywordHandler;
            });
        } else if (isRequired) {
          throw Error(`Missing required vocabulary: ${vocabularyId}`);
        }
      });

    // Meta validation
    if (!(schema.schemaVersion in metaValidators)) {
      const metaSchema = await Schema.get(schema.schemaVersion);
      metaValidators[schema.schemaVersion] = await validate(metaSchema);
    }

    const metaResults = metaValidators[schema.schemaVersion](schema.schema, metaOutputFormat);
    if (!metaResults.valid) {
      throw metaResults;
    }
  }

  // Compile
  await getKeyword(`${schema.schemaVersion}#validate`).compile(schema, ast);
  return Schema.uri(schema);
};

const interpretSchema = (schemaUrl, instance, ast) => {
  const [keywordId] = ast[schemaUrl];
  return getKeyword(keywordId).interpret(schemaUrl, instance, ast);
};

module.exports = {
  validate, setMetaOutputFormat, FLAG, BASIC, DETAILED, VERBOSE,
  getKeyword, hasKeyword, defineVocabulary,
  compileSchema, interpretSchema
};
