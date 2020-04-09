const PubSub = require("pubsub-js");
const { isObject } = require("./common");
const Instance = require("./instance");
const Schema = require("./schema");


const FLAG = "FLAG", BASIC = "BASIC", DETAILED = "DETAILED", VERBOSE = "VERBOSE";

let metaOutputFormat = DETAILED;
let shouldMetaValidate = true;

const validate = async (schema, value = undefined, outputFormat = undefined) => {
  const ast = {};
  const schemaUri = await compileSchema(schema, ast);
  const interpretAst = (value, outputFormat = FLAG) => interpret(ast, schemaUri)(Instance.cons(value), outputFormat);

  return value === undefined ? interpretAst : interpretAst(value, outputFormat);
};

const interpret = (ast, schemaUri) => (value, outputFormat = FLAG) => {
  if (![FLAG, BASIC, DETAILED, VERBOSE].includes(outputFormat)) {
    throw Error(`The '${outputFormat}' error format is not supported`);
  }

  let output = [];
  const subscriptionToken = PubSub.subscribe("result", outputHandler(outputFormat, output));
  interpretSchema(schemaUri, value, ast);
  PubSub.unsubscribe(subscriptionToken);

  return output[0];
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

const setShouldMetaValidate = (isEnabled) => {
  shouldMetaValidate = isEnabled;
};

const _keywords = {};
const getKeyword = (id) => _keywords[id];
const hasKeyword = (id) => id in _keywords;

const _vocabularies = {};
const defineVocabulary = (id, keywords) => {
  _vocabularies[id] = keywords;
};

const compileSchema = async (schema, ast) => {
  // Vocabularies
  if (!hasKeyword(`${schema.schemaVersion}#validate`)) {
    const metaSchema = await Schema.get(schema.schemaVersion);

    // Check for mandatory vocabularies
    (Schema.getConfig(metaSchema.id, "mandatoryVocabularies") || []).forEach((vocabularyId) => {
      if (!metaSchema.vocabulary[vocabularyId]) {
        throw Error(`Vocabulary '${vocabularyId}' must be explicitly declared and required`);
      }
    });

    // Load vocabularies
    Object.entries(metaSchema.vocabulary)
      .forEach(([vocabularyId, isRequired]) => {
        if (vocabularyId in _vocabularies) {
          Object.entries(_vocabularies[vocabularyId])
            .forEach(([keyword, keywordHandler]) => {
              _keywords[`${metaSchema.id}#${keyword}`] = keywordHandler;
            });
        } else if (isRequired) {
          throw Error(`Missing required vocabulary: ${vocabularyId}`);
        }
      });
  }

  // Meta validation
  if (shouldMetaValidate && !schema.validated) {
    Schema.markValidated(schema.id);

    // Compile
    const metaSchema = await Schema.get(schema.schemaVersion);
    const metaAst = {};
    const metaSchemaUri = await compileSchema(metaSchema, metaAst);
    const metaInterpret = interpret(metaAst, metaSchemaUri);

    // Interpret
    const schemaInstance = Instance.cons(schema.schema, schema.id);
    const metaResults = metaInterpret(schemaInstance, metaOutputFormat);
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
  validate, setMetaOutputFormat, setShouldMetaValidate, FLAG, BASIC, DETAILED, VERBOSE,
  getKeyword, hasKeyword, defineVocabulary,
  compileSchema, interpretSchema
};
