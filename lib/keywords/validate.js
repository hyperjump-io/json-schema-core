const Pact = require("@hyperjump/pact");
const PubSub = require("pubsub-js");
const Core = require("../core");
const Instance = require("../instance");
const Schema = require("../schema");


const compile = async (schema, ast) => {
  const url = Schema.uri(schema);
  if (!(url in ast)) {
    ast[url] = false; // Place dummy entry in ast to avoid recursive loops
    const schemaValue = Schema.value(schema);
    ast[url] = [
      `${schema.schemaVersion}#validate`,
      Schema.uri(schema),
      typeof schemaValue === "boolean" ? schemaValue : await Pact.pipeline([
        Schema.entries,
        Pact.map(([keyword, keywordSchema]) => {
          const keywordId = `${schema.schemaVersion}#${keyword}`;
          return [keywordId, keywordSchema];
        }),
        Pact.filter(([keywordId]) => Core.hasKeyword(keywordId) && keywordId !== `${schema.schemaVersion}#validate`),
        Pact.map(async ([keywordId, keywordSchemaPromise]) => {
          const keywordSchema = await keywordSchemaPromise;
          const keywordAst = await Core.getKeyword(keywordId).compile(keywordSchema, ast, schema);
          return [keywordId, Schema.uri(keywordSchema), keywordAst];
        }),
        Pact.all
      ], schema)
    ];
  }
};

const interpret = (uri, instance, ast) => {
  const [keywordId, schemaUrl, nodes] = ast[uri];

  const isValid = typeof nodes === "boolean" ? nodes : nodes
    .every(([keywordId, schemaUrl, keywordValue]) => {
      const isValid = Core.getKeyword(keywordId).interpret(keywordValue, instance, ast);

      PubSub.publishSync("result", {
        keyword: keywordId,
        absoluteKeywordLocation: schemaUrl,
        instanceLocation: Instance.uri(instance),
        valid: isValid
      });
      return isValid;
    });

  PubSub.publishSync("result", {
    keyword: keywordId,
    absoluteKeywordLocation: schemaUrl,
    instanceLocation: Instance.uri(instance),
    valid: isValid
  });
  return isValid;
};

const collectEvaluatedProperties = (uri, instance, ast, isTop = false) => {
  const nodes = ast[uri][2];

  if (typeof nodes === "boolean") {
    return nodes ? [] : false;
  }

  return nodes
    .filter(([keywordId]) => !isTop || !keywordId.endsWith("#unevaluatedProperties"))
    .reduce((acc, [keywordId, , keywordValue]) => {
      const propertyNames = acc && Core.getKeyword(keywordId).collectEvaluatedProperties(keywordValue, instance, ast);
      return propertyNames && acc.concat(propertyNames);
    }, []);
};

module.exports = { compile, interpret, collectEvaluatedProperties };
