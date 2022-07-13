import { expect } from "chai";
import nock from "nock";
import { Given, When, Then } from "./mocha-gherkin.spec";
import Schema from "./schema.js";
import type { SchemaDocument } from "./schema.js";


const testDomain = "http://test.jsc.hyperjump.io";
const dialectId = `${testDomain}/dialect/file-link-security`;

Schema.setConfig(dialectId, "baseToken", "$id");
Schema.add({
  "$id": dialectId,
  "$schema": dialectId
});

describe("Schema.get with files", () => {
  Given("a schema loaded from a file as the context schema", () => {
    let context: SchemaDocument;

    beforeEach(async () => {
      context = await Schema.get(`file://${__dirname}/no-id.fixture.json`);
    });

    When("getting a schema using a relative URL", () => {
      let schema: SchemaDocument;

      beforeEach(async () => {
        schema = await Schema.get("./file-id.fixture.json", context);
      });

      Then("it should resolve the relative URL against the context schema's URL and fetch the correct schema", () => {
        expect(Schema.uri(schema)).to.equal("file:///path/to/schema/file-id.fixture.json#");
      });
    });

    When("getting a schema using an absolute URL with a 'file' scheme", () => {
      let schema: SchemaDocument;

      beforeEach(async () => {
        schema = await Schema.get(`file://${__dirname}/file-id.fixture.json`, context);
      });

      Then("it should fetch the file", () => {
        expect(Schema.uri(schema)).to.equal("file:///path/to/schema/file-id.fixture.json#");
      });
    });

    When("getting a schema using an absolute URL with an 'http' scheme", () => {
      let schema: SchemaDocument;

      beforeEach(async () => {
        Schema.add({ "$id": `${testDomain}/foo`, "$schema": dialectId });
        schema = await Schema.get(`${testDomain}/foo`, context);
      });

      Then("it should fetch the file", () => {
        expect(Schema.uri(schema)).to.equal(`${testDomain}/foo#`);
      });
    });
  });

  Given("a schema with an 'http' identifier loaded from a file as the context schema", () => {
    let context: SchemaDocument;

    beforeEach(async () => {
      context = await Schema.get(`file://${__dirname}/http-id.fixture.json`);
    });

    When("getting a schema using a relative URL", () => {
      let schema: SchemaDocument;

      beforeEach(async () => {
        Schema.add({ "$id": `${testDomain}/foo`, "$schema": dialectId });
        schema = await Schema.get("./foo", context);
      });

      Then("it should resolve the relative URL against the context schema's URL and fetch the correct schema", () => {
        expect(Schema.uri(schema)).to.equal(`${testDomain}/foo#`);
      });
    });

    When("getting a schema using an absolute URL with an 'http' scheme", () => {
      let schema: SchemaDocument;

      beforeEach(async () => {
        Schema.add({ "$id": `${testDomain}/foo`, "$schema": dialectId });
        schema = await Schema.get(`${testDomain}/foo`, context);
      });

      Then("it should fetch the schema", () => {
        expect(Schema.uri(schema)).to.equal(`${testDomain}/foo#`);
      });
    });

    When("getting a schema using an absolute URL with a 'file' scheme", () => {
      Then("it should throw an error", () => {
        Schema.get(`file://${__dirname}/no-id.fixture.json`, context)
          .then(() => expect.fail())
          .catch((error) => expect(error).to.be.an("error"));
      });
    });
  });

  Given("a schema with a 'file' identifier", () => {
    const schemaFilePath = `${__dirname}/file-id.fixture.json`;

    When("the schema is retrieved from http", () => {
      beforeEach(() => {
        nock(testDomain)
          .get("/file-id")
          .replyWithFile(200, schemaFilePath);
      });

      Then("it should throw an error", () => {
        Schema.get(`${testDomain}/file-id`)
          .then(() => expect.fail())
          .catch((error) => expect(error).to.be.an("error"));
      });
    });
  });
});
