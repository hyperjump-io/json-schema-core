import { expect } from "chai";
import nock from "nock";
import { When, Then } from "./mocha-gherkin.spec";
import Schema from "./schema";
import type { SchemaDocument, SchemaObject } from "./schema";
import Core from "./core";
import Yaml from "yaml";


const testDomain = "http://test.jsc.hyperjump.io";
const dialectId = `${testDomain}/dialect/yaml-schema`;

Core.addMediaTypePlugin("application/schema+yaml", {
  parse: async (response) => [Yaml.parse(await response.text()) as SchemaObject, undefined],
  matcher: (path) => path.endsWith(".schema.yaml")
});
Schema.setConfig(dialectId, "baseToken", "$id");

describe("Schema.get with YAML", () => {
  When("fetching a YAML schema from the file system", () => {
    let schema: SchemaDocument;

    beforeEach(async () => {
      schema = await Schema.get(`file://${__dirname}/string.schema.yaml`);
    });

    Then("it should parse the YAML and load the schema", () => {
      expect(Schema.value(schema)).to.eql({ type: "string" });
    });
  });

  When("fetching a YAML schema from the web", () => {
    let schema: SchemaDocument;

    beforeEach(async () => {
      nock(testDomain)
        .get("/string")
        .replyWithFile(200, `${__dirname}/string.schema.yaml`, { "Content-Type": "application/schema+yaml" });
      schema = await Schema.get(`${testDomain}/string`);
    });

    Then("it should parse the YAML and load the schema", () => {
      expect(Schema.value(schema)).to.eql({ type: "string" });
    });
  });
});
