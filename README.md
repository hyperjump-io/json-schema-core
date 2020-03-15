# JSON Schema Core
JSON Schema Core (JSC) is a framework for building JSON Schema based validators
and other tools.

It includes tools for:
* Working with schemas (`$id`, `$schema`, `$ref`, etc)
* Working with instances
* Building custom keywords
* Building vocabularies
* Standard output formats

## Install
JSC is designed to run in a vanilla node.js environment, but has no dependencies
on node.js specific libraries so it can be bundled for the browser. No
compilers, preprocessors, or bundlers are used.

### Node.js
```bash
npm install @hyperjump/json-schema-core
```

### Browser
When in a browser context, JSC is designed to use the browser's `fetch`
implementation instead of a node.js fetch clone. The Webpack bundler does this
properly without any extra configuration, but if you are using the Rollup
bundler you will need to include the `browser: true` option in your Rollup
configuration.

```javascript
  plugins: [
    resolve({
      browser: true
    }),
    commonjs()
  ]
```

## Schema
A Schema Document (SDoc) is a structure that includes the schema, the id, and a
JSON Pointer. The "value" of an SDoc is the portion of the schema that the JSON
pointer points to. This allows an SDoc to represent any value in the schema
while maintaining enough context to follow `$ref`s and track the position in the
document.

* **Schema.add**: (schema: object, url?: URI, schemaVersion?: string) => undefined

    Load a schema. See the "$id" and "$schema" sections for more details
* **Schema.get**: (url: URI, contextDoc?: SDoc, recursive: boolean = false) => Promise<SDoc>

    Fetch a schema. Schemas can come from an HTTP request, a file, or a schema
    that was added with `Schema.add`.
* **Schema.uri**: (doc: SDoc) => URI

    Returns a URI including the id and JSON Pointer that represents a value
    within the schema.
* **Schema.value**: (doc: SDoc) => any

    The portion of the schema the document's JSON Pointer points to.
* **Schema.step**: (key: string, doc: SDoc) => Promise<SDoc>

    Similar to `schema[key]`, but returns an SDoc.
* **Schema.sibling**: (key: string, doc: SDoc) => Promise<SDoc>

    Similar to `Schema.step`, but gets an adjacent key.
* **Schema.entries**: (doc: SDoc) => [key, Promise<SDoc>]

    Similar to `Object.entries`, but returns SDocs for values.
* **Schema.map**: (fn: (item: Promise<SDoc>, index: integer) => T, doc: SDoc) => [T]

    A `map` function for an SDoc whose value is an array.

### $id
JSC requires that all schemas are identified by at least one URI. There are two
types of schema identifiers, internal and external. An internal identifier is an
identifier that is specified within the schema using `$id`. An external
identifier is an identifier that is specified outside of the schema. In JSC, an
external identifier can be either the URL a schema is retrieved with, or the
identifier specified when using `Schema.add` to load a schema.

JSC can fetch schemas from the web or from the file system, but when fetching
from the file system, there are limitations for security reasons. If
your schema has an identifier with an http scheme (**http**://example.com), it's
not allowed to reference (`$ref`) schemas with a file scheme
(**file**:///path/to/my/schemas).

Internal identifiers (`$id`s) are resolved against the external identifier of
the schema (if one exists) and the resulting URI is used to identify the schema.
All identifiers must be absolute URIs. External identifiers are required to be
absolute URIs and internal identifiers must resolve to absolute URIs.

```javascript
cosnt { JsonSchema, Schema } = require("@hyperjump/json-schema-core");


// Example: Inline schema with external identifier
const schemaJson = {
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "type": "string"
}
Schema.add(schemaJson, "http://example.com/schemas/string");
const schema = await Schema.get("http://example.com/schemas/string");

// Example: Inline schema with internal identifier
const schemaJson = {
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "$id": "http://example.com/schemas/string",
  "type": "string"
}
Schema.add(schemaJson);
const schema = await Schema.get("http://example.com/schemas/string");

// Example: Inline schema with no identifier
const schemaJson = {
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "type": "string"
}
Schema.add(schemaJson); // Error: Couldn't determine an identifier for the schema

// Given the following schema at http://example.com/schemas/foo
// {
//  "$schema": "https://json-schema.org/draft/2019-09/schema",
//  "$id": "http://example.com/schemas/string",
//  "type": "string"
// }

// Example: Fetch schema from external HTTP identifier
const schema = await Schema.get("http://example.com/schemas/string");

// Example: Fetch schema from internal identifier
const schema = await Schema.get("http://example.com/schemas/foo");

// Given the following schema at http://example.com/schemas/bar
// {
//  "$schema": "https://json-schema.org/draft/2019-09/schema",
//  "$id": "string",
//  "type": "string"
// }

// Example: Fetch schema from internal identifier resolved against external identifier
const schema = await Schema.get("http://example.com/schemas/string");

// Given the following schema at /path/to/my/schemas/string.schema.json
// {
//  "$schema": "https://json-schema.org/draft/2019-09/schema",
//  "type": "string"
// }

// Example: Fetch schema from external FILE identifier
const schema = await Schema.get("file:///path/to/my/schemas/string.schema.json");

// Given the following schema at /path/to/my/schemas/string.schema.json
// {
//  "$schema": "https://json-schema.org/draft/2019-09/schema",
//  "type": "string"
// }
//
// Given the following schema at http://example.com/schemas/baz
// {
//  "$schema": "https://json-schema.org/draft/2019-09/schema",
//  "$ref": "file:///path/to/my/schemas/string.schema.json"
// }

// Example: Reference file from network context
const schema = await Schema.get("http://example.com/schemas/baz");
const validateString = await JsonSchema.validate(schema); // Error: Can't access file resource from network context
```

### $schema
JSC is designed to support multiple drafts of JSON Schema and it makes no
assumption about what draft your schema uses. You need to specify it in some
way. The preferred way is to the use `$schema` in all of your schemas, but you
can also specify what draft to use when adding a schema using `Schema.add`. If a
draft is specified in `Schema.add` and the schema has a `$schema`, the
`$schema` will be used. If no draft is specified, you will get an error.

```javascript
// Example: Internal schema version
const schemaJSON = {
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "$id": "http://example.com/schemas/string",
  "type": "string"
};
Schema.add(schemaJSON);

// Example: External schema version
const schemaJSON = {
  "type": "string"
};
Schema.add(schemaJSON, "http://example.com/schemas/string", "https://json-schema.org/draft/2019-09/schema");

// Example: No schema version
const schemaJSON = {
  "$id": "http://example.com/schemas/string",
  "type": "string"
};
Schema.add(schemaJSON); // Error: Couldn't determine schema version

// Given the following schema at http://example.com/schemas/foo
// {
//   "type": "string"
// }

// Example: No schema version external
const schema = Schema.get("http://example.com/schemas/string"); // Error: Couldn't determine schema version
```

## Json
A JSON Document (JDoc) is like a Schema Document (SDoc) except with much more
limited functionality.

* **Json.cons**: (json: any) => JDoc

    Construct a JDoc from a value.
* **Json.get**: (url: URI, contextDoc: JDoc) => JDoc

    Apply a same-resource reference to a JDoc.
* **Json.uri**: (doc: JDoc) => URI

    Returns a URI including the id and JSON Pointer that represents a value
    within the instance.
* **Json.value**: (doc: JDoc) => any

    The portion of the instance that the document's JSON Pointer points to.
* **Json.step**: (key: string, doc: JDoc) => JDoc

    Similar to `schema[key]`, but returns a JDoc.
* **Json.entries**: (doc: JDoc) => [key, JDoc]

    Similar to `Object.entries`, but returns JDocs for values.
* **Json.map**: (fn: (item: JDoc, index: integer) => T, doc: JDoc) => [T]

    A `map` function for a JDoc whose value is an array.
* **Json.reduce**: (fn: (accumulator: T, item: JDoc, index: integer) => T, initial: T, doc: JDoc) => T

    A `reduce` function for a JDoc whose value is an array.
* **Json.every**: (fn: (doc: JDoc, index: integer) => boolean, doc: JDoc) => boolean

    An `every` function for a JDoc whose value is an array.
* **Json.some**: (fn: (doc: JDoc, index: integer) => boolean, doc: JDoc) => boolean

    A `some` function for a JDoc whose value is an array.

## Output
JSC supports all of the standard output formats specified for JSON Schema
draft-2019-09 and is separately configurable for instance validation and
meta-validtion.

* JsonSchema.FLAG - Default for instance validation
* JsonSchema.BASIC
* JsonSchema.DETAILED - Default for meta-validation
* JsonSchema.VERBOSE

This implementation does not include the suggested `keywordLocation` property in
the output unit. I think `absoluteKeywordLocation`+`instanceLocation` is
sufficient for debugging and it's awkward for the output to produce JSON
Pointers that potentially won't resolve because they cross schema boundaries.

This implementation includes an extra property in the output unit called
`keyword`. This is an identifier (URI) for the keyword that was validated. With
the standard output unit fields, we can see what keyword was validated by
inspecting the last segment of the `absoluteKeywordLocation` property. But,
since JSC can support multiple JSON Schema versions, we would have to pull up
the actual schema to find what draft was used. The `schema` property gives us
enough information to not have to go back to the schema to know what draft is
being used.

```javascript
const { JsonSchema, Schema } = require("@hyperjump/json-schema-core");


// Example: Specify instance validation output format
Schema.add({
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "$id": "http://example.com/schemas/string",
  "type": "string"
});
const schema = await Schema.get("http://example.com/schemas/string");
const isString = await JsonSchema.validate(schema);
const output = isString(42, JsonSchema.BASIC); // => {
//   "keyword": "https://json-schema.org/draft/2019-09/schema",
//   "absoluteKeywordLocation": "http://example.com/schemas/string#",
//   "instanceLocation": "#",
//   "valid": false,
//   "errors": [
//     {
//       "keyword": "https://json-schema.org/draft/2019-09/schema#type",
//       "absoluteKeywordLocation": "http://example.com/schemas/string#/type",
//       "instanceLocation": "#",
//       "valid": false
//     }
//   ]
// }

// Example: Specify meta-validation output format
Schema.add({
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "$id": "http://example.com/schemas/foo",
  "type": "this-is-not-a-valid-type"
});
JsonSchema.setMetaOutputFormat(JsonSchema.BASIC);
const schema = await Schema.get("http://example.com/schemas/foo");
const isString = await JsonSchema.validate(schema); // Error: {
//   "keyword": "https://json-schema.org/draft/2019-09/schema",
//   "absoluteKeywordLocation": "https://json-schema.org/draft/2019-09/schema#",
//   "instanceLocation": "#",
//   "valid": false,
//   "errors": [
//     {
//       "keyword": "https://json-schema.org/draft/2019-09/schema#allOf",
//       "absoluteKeywordLocation": "https://json-schema.org/draft/2019-09/schema#/allOf",
//       "instanceLocation": "#",
//       "valid": false
//     }
//     ...
//   ]
// }
```

## PubSub
JSC emits events that you can subscribe to and work with however your
application needs. For now, the only event is the `"result"` event that emits
output units every time a keyword is validated. Internally, JSC uses these
events to build standard output formats. Other events can be added when
use-cases are identified for them.

```javascript
const PubSub = require("pubsub-js");
const { JsonSchema, Schema } = require("@hyperjump/json-schema-core");


Schema.add({
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "$id": "http://example.com/schemas/string",
  "type": "string"
});
const schema = await Schema.get("http://example.com/schemas/string");
const isString = await JsonSchema.validate(schema);

const results = [];
const subscriptionToken = PubSub.subscribe("result", (message, result) => {
  results.push(result);
});
isString(42);
PubSub.unsubscribe(subscriptionToken);
results; // => [
//   {
//     "keyword": "https://json-schema.org/draft/2019-09/schema",
//     "absoluteKeywordLocation": "http://example.com/schemas/string#",
//     "instanceLocation": "#",
//     "valid": false
//   },
//   {
//     "keyword": "https://json-schema.org/draft/2019-09/schema#type",
//     "absoluteKeywordLocation": "http://example.com/schemas/string#/type",
//     "instanceLocation": "#",
//     "valid": false
//   }
// ]

```

## Customize
JSC uses a micro-kernel architecture, so it's highly customizable.  Everything
is a plugin, even the validation logic is a plugin. So, in theory, you can use
JSC as a framework for building other types of JSON Schema based tools such as
code generators or form generators.

In addition to this documentation you should be able to look at the code to see
an example of how to add your custom plugins because it's all implemented the
same way.

### Custom Meta-Schemas
Let's say you want to use a custom meta-schema that does stricter validation
than the standard meta-schema. Once you have your custom meta-schema ready, it's
just a couple lines of code to start using it.

```javascript
const { JsonSchema } = require("@hyperjump/json-schema-core");


// Optional: Load your meta-schema. If you don't do this, JSC will fetch it
// using it's identifier when it's needed.
const myCustomMetaSchema = require("./my-custom-meta-schema.schema.json");
Schema.add(myCustomMetaSchema);

// Choose a unique URI for your meta-schema
// We want validation to function exactly the same way, so we can use the
// standard `validate` keyword.
const validate = require("jschema/lib/keywords/validate");
JsonSchema.addkeyword("http://example.com/draft/2019-09-strict/schema#validate", validate);

// Use the URI you chose for your meta-schema for the `$schema` in you schemas.
Schema.add({
  "$schema": "http://example.com/draft/2019-09-strict/schema",
  "$id": "http://example.com/schemas/string",
  "type": "string"
});
const schema = await Schema.get("http://example.com/schemas/string");
await JsonSchema.validate(schema, "foo");
```

### Custom Keywords
Creating a new keyword takes three steps
1. Implement your keyword
1. Create a custom meta-schema to validate your keyword (see previous section)
1. Register your keyword

A keyword implementation is a module with two functions: `compile` and
`interpret`. In the `compile` step, you can do any processing steps necessary to
do the actual validation in the `interpret` step. The most common thing to do in
the `compile` step is to compile sub-schemas. The `interpret` step takes the
result of the `compile` step and returns a boolean value indicating whether
validation has passed or failed. Use the JSON Schema keyword implementations in
this package as examples to get started.

When you have your new keyword implementation, you'll need a custom meta-schema
to validate that the new keyword is used correctly.

```javascript
// This example implements an `if`/`then`/`else`-like keyword called `cond`.
// `cond` is an array of schemas where the first is the `if` schema, the second
// is the `then` schema, and the third is the `else` schema.
const { JsonSchema, Schema, Keywords } = require("@hyperjump/json-schema-core");

const cond = {
  compile: async (schema, ast) => {
    const subSchemas = Schema.map((subSchema) => JsonSchema.compileSchema(subSchema, ast), schema);
    return Promise.all(subSchemas);
  },

  interpret: (cond, json, ast) => {
    return JsonSchema.interpretSchema(cond[0], json, ast)
      ? (cond[1] ? Core.interpretSchema(cond[1], json, ast) : true)
      : (cond[2] ? Core.interpretSchema(cond[2], json, ast) : true);
  }
};

JsonSchema.addkeyword("http://example.com/draft/custom/schema#validate", Keywords.validate);
JsonSchema.addkeyword("http://example.com/draft/custom/schema#cond", cond);

Schema.add({
  "$schema": "http://example.com/draft/custom/schema",
  "$id": "http://example.com/schemas/cond",
  "type": "integer",
  "cond": [
    { "minimum": 10 },
    { "multipleOf": 3 },
    { "multipleOf": 2 }
  ]
});
const schema = await Schema.get("http://example.com/schemas/cond");
await Schema.validate(schema, 42);
```

### Vocabularies
You can create vocabularies with JSC as well. A vocabulary is just a named
collection of keywords. Creating a vocabulary takes three steps:
1. Create a meta-schema for the vocabulary
1. Create a meta-schema that that includes the vocabulary
1. Register the keywords for the vocabulary

```javascript
const { JsonSchema, Schema } = require("@hyperjump/json-schema-core");
const cond = require("./keywords/cond.js");

JsonSchema.addVocabulary("https://example.com/draft/custom/vocab/conditionals", {
  cond: cond
});

Schema.add({
  "$schema": "http://example.com/draft/custom/schema",
  "$id": "http://example.com/schemas/cond",
  "type": "integer",
  "cond": [
    { "minimum": 10 },
    { "multipleOf": 3 },
    { "multipleOf": 2 }
  ]
});
const schema = await Schema.get("http://example.com/schemas/cond");
await JsonSchema.validate(schema, 42);
```

## Contributing

### Tests

Run the tests

```bash
npm test
```

Run the tests with a continuous test runner

```bash
npm test -- --watch
```
