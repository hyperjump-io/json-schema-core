const curry = require("just-curry-it");
const PubSub = require("pubsub-js");
const Instance = require("./instance");
const Schema = require("./schema");
const InvalidSchemaError = require("./invalid-schema-error");


const FLAG = "FLAG", BASIC = "BASIC", DETAILED = "DETAILED", VERBOSE = "VERBOSE";

let metaOutputFormat = DETAILED;
let shouldMetaValidate = true;

const validate = async (schema, value = undefined, outputFormat = undefined) => {
  const compiled = await compile(schema);
  const interpretAst = (value, outputFormat = FLAG) => interpret(compiled, Instance.cons(value), outputFormat);

  return value === undefined ? interpretAst : interpretAst(value, outputFormat);
};

const compile = async (schema) => {
  const ast = {};
  const schemaUri = await compileSchema(schema, ast);
  return { ast, schemaUri };
};

const interpret = curry(({ ast, schemaUri }, value, outputFormat = FLAG) => {
  if (![FLAG, BASIC, DETAILED, VERBOSE].includes(outputFormat)) {
    throw Error(`The '${outputFormat}' error format is not supported`);
  }

  let output = [];
  const subscriptionToken = PubSub.subscribe("result", outputHandler(outputFormat, output));
  interpretSchema(schemaUri, value, ast);
  PubSub.unsubscribe(subscriptionToken);

  return output[0];
});

const outputHandler = (outputFormat, output) => {
  const resultStack = [];

  return (message, keywordResult) => {
    const { keyword, absoluteKeywordLocation, instanceLocation, valid } = keywordResult;
    const result = { keyword, absoluteKeywordLocation, instanceLocation, valid, errors: [] };
    while (resultStack.length > 0 && isChild(resultStack[resultStack.length - 1], result)) {
      const topResult = resultStack.pop();
      let errors = [];
      if (outputFormat === BASIC) {
        errors = topResult.errors;
        delete topResult.errors;
      }
      result.errors.unshift(topResult, ...errors);
    }

    if (outputFormat === VERBOSE || (outputFormat !== FLAG && !result.valid)) {
      resultStack.push(result);
    }

    output[0] = result;
  };
};

const isChild = (topResult, nextResult) => {
  return topResult.absoluteKeywordLocation.startsWith(nextResult.absoluteKeywordLocation)
      || nextResult.keyword.endsWith("#validate") && topResult.instanceLocation === nextResult.instanceLocation;
};

const setMetaOutputFormat = (format) => {
  metaOutputFormat = format;
};

const setShouldMetaValidate = (isEnabled) => {
  shouldMetaValidate = isEnabled;
};

const _keywords = {};
const getKeyword = (id) => _keywords[id];
const hasKeyword = (id) => id in _keywords;
const addKeyword = (id, keywordHandler) => {
  _keywords[id] = {
    collectEvaluatedItems: (keywordValue, instance, ast) => keywordHandler.interpret(keywordValue, instance, ast) && 0,
    collectEvaluatedProperties: (keywordValue, instance, ast) => keywordHandler.interpret(keywordValue, instance, ast) && [],
    ...keywordHandler
  };
};

const _vocabularies = {};
const defineVocabulary = (id, keywords) => {
  _vocabularies[id] = keywords;
};

const metaValidators = {};
const compileSchema = async (schema, ast) => {
  // Vocabularies
  if (!hasKeyword(`${schema.schemaVersion}#validate`)) {
    const metaSchema = await Schema.get(schema.schemaVersion);

    // Check for mandatory vocabularies
    const mandatoryVocabularies = Schema.getConfig(metaSchema.id, "mandatoryVocabularies") || [];
    mandatoryVocabularies.forEach((vocabularyId) => {
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
              addKeyword(`${metaSchema.id}#${keyword}`, keywordHandler);
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
    if (!(schema.schemaVersion in metaValidators)) {
      const metaSchema = await Schema.get(schema.schemaVersion);
      const metaAst = {};
      const metaSchemaUri = await compileSchema(metaSchema, metaAst);
      metaValidators[metaSchema.id] = interpret({ ast: metaAst, schemaUri: metaSchemaUri });
    }

    // Interpret
    const schemaInstance = Instance.cons(schema.schema, schema.id);
    const metaResults = metaValidators[schema.schemaVersion](schemaInstance, metaOutputFormat);
    if (!metaResults.valid) {
      throw new InvalidSchemaError(metaResults);
    }
  }

  // Compile
  await getKeyword(`${schema.schemaVersion}#validate`).compile(schema, ast);
  return Schema.uri(schema);
};

const interpretSchema = (schemaUri, instance, ast) => {
  const [keywordId] = ast[schemaUri];
  return getKeyword(keywordId).interpret(schemaUri, instance, ast);
};

const collectEvaluatedProperties = (schemaUri, instance, ast, isTop) => {
  const [keywordId] = ast[schemaUri];
  return getKeyword(keywordId).collectEvaluatedProperties(schemaUri, instance, ast, isTop);
};

const collectEvaluatedItems = (schemaUri, instance, ast, isTop) => {
  const [keywordId] = ast[schemaUri];
  return getKeyword(keywordId).collectEvaluatedItems(schemaUri, instance, ast, isTop);
};

module.exports = {
  validate, compile, interpret,
  setMetaOutputFormat, setShouldMetaValidate, FLAG, BASIC, DETAILED, VERBOSE,
  getKeyword, hasKeyword, defineVocabulary,
  compileSchema, interpretSchema, collectEvaluatedProperties, collectEvaluatedItems
};
