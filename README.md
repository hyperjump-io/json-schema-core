# Hyperjump - JSON Schema Core
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

* **Schema.setConfig**: (schemaVersion: string, configName: string, configValue: string) => any

    Set a configuration value for a schemaVersion.
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
* **Schema.has**: (key: string, doc: SDoc) => Promise<SDoc>

    Similar to `key in schema`.
* **Schema.step**: (key: string, doc: SDoc) => Promise<SDoc>

    Similar to `schema[key]`, but returns an SDoc.
* **Schema.sibling**: (key: string, doc: SDoc) => Promise<SDoc>

    Similar to `Schema.step`, but gets an adjacent key.
* **Schema.entries**: (doc: SDoc) => Promise<[[string, SDoc]]>

    Similar to `Object.entries`, but returns SDocs for values.
* **Schema.map**: (fn: (item: Promise<SDoc>, index: integer) => T, doc: SDoc) => Promise<[T]>

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
not allowed to reference schemas with a file scheme
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

### Meta Validation
By default JSC will validate all schemas against their meta-schema. However, the
only time you really need this is when developing schemas. When JSV is running
in a production environment or you are working with third-party schemas that you
trust to be correct, you can turn off meta-validation to boost performance.

```javascript
JsonSchema.setShouldMetaValidate(false);

const schema = await Schema.get("http://example.com/schemas/foo");
const isString = await JsonSchema.validate(schema);
isString("foo"); // true
```

## Instance
An Instance Document (IDoc) is like a Schema Document (SDoc) except with much
more limited functionality.

* **Instance.cons**: (instance: any) => IDoc

    Construct a IDoc from a value.
* **Instance.get**: (url: URI, contextDoc: IDoc) => IDoc

    Apply a same-resource reference to a IDoc.
* **Instance.uri**: (doc: IDoc) => URI

    Returns a URI including the id and JSON Pointer that represents a value
    within the instance.
* **Instance.value**: (doc: IDoc) => any

    The portion of the instance that the document's JSON Pointer points to.
* **Instance.step**: (key: string, doc: IDoc) => IDoc

    Similar to `schema[key]`, but returns a IDoc.
* **Instance.entries**: (doc: IDoc) => [key, IDoc]

    Similar to `Object.entries`, but returns IDocs for values.
* **Instance.map**: (fn: (item: IDoc, index: integer) => T, doc: IDoc) => [T]

    A `map` function for a IDoc whose value is an array.
* **Instance.reduce**: (fn: (accumulator: T, item: IDoc, index: integer) => T, initial: T, doc: IDoc) => T

    A `reduce` function for a IDoc whose value is an array.
* **Instance.every**: (fn: (doc: IDoc, index: integer) => boolean, doc: IDoc) => boolean

    An `every` function for a IDoc whose value is an array.
* **Instance.some**: (fn: (doc: IDoc, index: integer) => boolean, doc: IDoc) => boolean

    A `some` function for a IDoc whose value is an array.

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
JSC uses a micro-kernel architecture, so it's highly customizable. Everything
is a plugin, even the validation logic is a plugin. So, in theory, you can use
JSC as a framework for building other types of JSON Schema based tools such as
code generators or form generators.

In addition to this documentation you should be able to look at the
[JSV](https://github.com/hyperjump-io/json-schema-validator) code to see an example of how
to add your custom plugins because it's all implemented the same way.

### References
The `$ref` keyword has changed a couple times over the last several drafts. JSC
allows you to configure which version(s) of `$ref`s you want to support. There
are four types of references.

* **JSON Reference**: *(draft-04)* References are defined in a separate spec
  from JSON Schema. The JSON Schema spec only constrains `$ref` in how URIs are
  resolved with respect to `id`.

* **JSON Schema Reference**: *(draft-06/7)* The JSON Schema spec absorbed the
  JSON Reference spec and further constrained `$ref` to only be allowed where
  schemas are allowed. JSC doesn't support this type of reference because I
  haven't figured out how to do it a keyword agnostic way. You can use JSON
  References instead and it will just be a little more lenient about where
  references are allowed.

* **Keyword Reference**: *(draft-2019-09)* A reference was changed from being an
  object with a `$ref` property to the value of a `$ref` keyword. This allowed
  `$ref` to behave more like a keyword.

* **Keyword Recursive Reference**: *(draft-2019-09)* Along with
  `$recursiveAnchor`, this new type of reference was added to the spec to make
  it easier to write custom meta-schemas.

References can be configured by `$schema` identifier. When you create a custom
meta-schema, you will need to configure which types of references your schema
version supports. You do this with `Schema.setConfig`.

```javascript
const { Schema } = require("@hyperjump/json-schema-core");


// Configure draft-2019-09 style references
Schema.setConfig("https://json-schema.org/draft/2019-09/schema", "keywordReference", true);
Schema.setConfig("https://json-schema.org/draft/2019-09/schema", "keywordRecursiveReference", true);

// Configure draft-04/6/7 style references
Schema.setConfig("http://json-schema.org/draft-04/schema", "jsonReference", true);
```

### Identifiers
The `$id` keyword has seen it's fair share of churn as well. Although the spec
around this keyword was rewritten an clarified many times, the vast majority of
changes have simply been name changes. JSC allows you to configure which version
you want to support.

* **id**: *(draft-04)* A base URI used to resolve reference URIs.

* **$id**: *(draft-06/07)* Same as `id`, just a different name.

* **$id**: *(draft-2019-09)* Same as `$id` except with same-document reference
  support split out into `$anchor`.

* **$anchor**: *(draft-2019-09)* Same as same-document reference draft 2019-09
  `$id`s.

In draft-2019-09, `$id` was redefined from being a resolution scope modifier to
being an inlined reference. This means that JSON Pointers can not cross into
schemas with `$id`s. So far, JSC only supports these bounded `$id`s. If I come
up with a way to relax this constraint for old draft implementations, I will,
but since there is no sensible reason to want such a thing, it's a low priority.

In JSON Schema, properties called `$id` are only considered identifiers if they
appear in a schema. JSC is keyword agnostic, so it doesn't know what is a schema
and what isn't. Therefore, an `$id` might be treated as an identifier in places
it's not expected to. This is unlikely, but not impossible.

```javascript
const { Schema } = require("@hyperjump/json-schema-core");


// Configure draft-2019-09 style identifiers
Schema.setConfig("https://json-schema.org/draft/2019-09/schema", "idToken", "$id");
Schema.setConfig("https://json-schema.org/draft/2019-09/schema", "anchorToken", "$anchor");

// Configure draft-06/7 style references
Schema.setConfig("http://json-schema.org/draft-04/schema", "idToken", "$id");
Schema.setConfig("http://json-schema.org/draft-04/schema", "anchorToken", "$id");

// Configure draft-04 style references
Schema.setConfig("http://json-schema.org/draft-04/schema", "idToken", "id");
Schema.setConfig("http://json-schema.org/draft-04/schema", "anchorToken", "id");
```

### Custom Meta-Schemas
Let's say you want to use a custom meta-schema that does stricter validation
than the standard meta-schema. Once you have your custom meta-schema ready, it's
just a couple lines of code to start using it.

```javascript
const { JsonSchema, Schema } = require("@hyperjump/json-schema-core");


// Optional: Load your meta-schema. If you don't do this, JSC will fetch it
// using it's identifier when it's needed.
Schema.add({
  "$id": "https://example.com/draft/2019-09-strict/schema",
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "$vocabulary": {
    "https://json-schema.org/draft/2019-09/vocab/core": true,
    "https://json-schema.org/draft/2019-09/vocab/applicator": true,
    "https://json-schema.org/draft/2019-09/vocab/validation": true,
    "https://json-schema.org/draft/2019-09/vocab/meta-data": true,
    "https://json-schema.org/draft/2019-09/vocab/format": false,
    "https://json-schema.org/draft/2019-09/vocab/content": true
  },
  ...
});

// Use the URI you chose for your meta-schema for the `$schema` in you schemas.
Schema.add({
  "$id": "http://example.com/schemas/string",
  "$schema": "http://example.com/draft/2019-09-strict/schema",
  "type": "string"
});
const schema = await Schema.get("http://example.com/schemas/string");
await JsonSchema.validate(schema, "foo");
```

### Keywords
A keyword implementation is a module with two functions: `compile` and
`interpret`. In the `compile` step, you can do any processing steps necessary to
do the actual validation in the `interpret` step. The most common things to do
in the `compile` step is to follow references and compile sub-schemas. The
`interpret` step takes the result of the `compile` step and returns a boolean
value indicating whether validation has passed or failed. You can Use the [JSON
Schema Validator (JSV)](https://github.com/hyperjump-io/json-schema-validator)
keyword implementations in this package as examples.

This example implements an `if`/`then`/`else`-like keyword called `cond`.
`cond` is an array of schemas where the first is the `if` schema, the second is
the `then` schema, and the third is the `else` schema.

```javascript
const { JsonSchema, Schema, Keywords } = require("@hyperjump/json-schema-core");


const cond = {
  compile: async (cond, ast) => {
    const schemas = Schema.map((schema) => JsonSchema.compileSchema(schema, ast), cond);
    return Promise.all(schemas);
  },

  interpret: (cond, instance, ast) => {
    return JsonSchema.interpretSchema(cond[0], instance, ast)
      ? (cond[1] ? JsonSchema.interpretSchema(cond[1], instance, ast) : true)
      : (cond[2] ? JsonSchema.interpretSchema(cond[2], instance, ast) : true);
  }
});
```

In order to use an keyword in an implementation, you need to add it to a
vocabulary.

### Vocabularies
A vocabulary is just a named collection of keywords.

```javascript
const { JsonSchema, Schema } = require("@hyperjump/json-schema-core");
const cond = require("./keywords/cond.js");


// Choose a URI for your vocabulary and add keywords
JsonSchema.defineVocabulary("https://example.com/draft/custom/vocab/conditionals", {
  cond: cond
});

// Create a new meta-schema an add your vocabulary to `$vocabulary`
Schema.add({
  "$id": "https://example.com/draft/custom/schema",
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "$vocabulary": {
    ...
    "https://example.com/draft/custom/vocab/conditionals": true
  },
  ...
});

// Try it out
Schema.add({
  "$id": "http://example.com/schemas/cond-example",
  "$schema": "https://example.com/draft/custom/schema",
  "type": "integer",
  "cond": [
    { "minimum": 10 },
    { "multipleOf": 3 },
    { "multipleOf": 2 }
  ]
});
const schema = await Schema.get("http://example.com/schemas/cond-example");
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
