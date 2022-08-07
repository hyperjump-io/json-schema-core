import { expect } from "chai";
import nock from "nock";
import { Given, Then } from "./mocha-gherkin.spec";
import Schema from "./schema.js";
import type { SchemaObject } from "./schema.js";


const testDomain = "http://test.jsc.hyperjump.io";

const dialectId = `${testDomain}/dialect/dialect-identification`;
Schema.setConfig(dialectId, "baseToken", "$id");

const customDialectId = `${testDomain}/dialect/dialect-identification/custom`;
Schema.setConfig("https://json-schema.org/draft/2020-12/vocab/core", "baseToken", "$id");
Schema.setConfig("https://json-schema.org/draft/2020-12/vocab/core", "vocabularyToken", "$vocabulary");
Schema.add({
  $id: customDialectId,
  $schema: customDialectId,
  $vocabulary: {
    "https://json-schema.org/draft/2020-12/vocab/core": true
  }
});

describe("Dialect identification", () => {
  describe("Invalid media type", () => {
    Given("a schema with Content-Type: application/octet-stream", () => {
      beforeEach(() => {
        nock(testDomain)
          .get("/no-content-type")
          .reply(200, JSON.stringify({}), {
            "Content-Type": "application/octet-stream"
          });
      });

      Then("it should throw an error when retrieving the schema", async () => {
        try {
          await Schema.get(`${testDomain}/no-content-type`);
          expect.fail("Expected exception");
        } catch (error: unknown) {
          if (error instanceof Error) {
            expect(error.message).to.include("is not a schema");
          }
        }
      });
    });

    Given("a schema with Content-Type: application/json", () => {
      beforeEach(() => {
        nock(testDomain)
          .get("/json")
          .reply(200, JSON.stringify({}), {
            "Content-Type": "application/json"
          });
      });

      Then("it should throw an error when retrieving the schema", async () => {
        try {
          await Schema.get(`${testDomain}/json`);
          expect.fail("Expected exception");
        } catch (error: unknown) {
          if (error instanceof Error) {
            expect(error.message).to.include("is not a schema");
          }
        }
      });
    });
  });

  Given("a schema without $schema", () => {
    beforeEach(() => {
      nock(testDomain)
        .get("/schema-json")
        .reply(200, JSON.stringify({}), {
          "Content-Type": "application/schema+json"
        });
    });

    Then("it should throw an error when retrieving the schema", async () => {
      try {
        await Schema.get(`${testDomain}/schema-json`);
        expect.fail("Expected exception");
      } catch (error: unknown) {
        if (error instanceof Error) {
          expect(error.message).to.include("Couldn't determine schema dialect");
        }
      }
    });
  });

  describe("$schema", () => {
    Given("a schema with an unknown $schema", () => {
      beforeEach(() => {
        nock(testDomain)
          .get("/schema-json-unknown")
          .reply(200, JSON.stringify({ $schema: `${testDomain}/dialect/unknown` }), {
            "Content-Type": "application/schema+json"
          });

        nock(testDomain)
          .get("/dialect/unknown")
          .reply(404);
      });

      Then("it should throw an error when retrieving the schema", async () => {
        try {
          await Schema.get(`${testDomain}/schema-json-unknown`);
          expect.fail("Expected exception");
        } catch (error: unknown) {
          if (error instanceof Error) {
            expect(error.message).to.include("Failed to retrieve schema");
          }
        }
      });
    });

    Given("a schema with a known $schema", () => {
      beforeEach(() => {
        nock(testDomain)
          .get("/schema-json-known")
          .reply(200, JSON.stringify({ $schema: dialectId }), {
            "Content-Type": "application/schema+json"
          });
      });

      Then("it should throw an error when retrieving the schema", async () => {
        const schema = await Schema.get(`${testDomain}/schema-json-known`);
        expect(schema.dialectId).to.equal(dialectId);
      });
    });

    Given("a schema with a custom $schema with a known core vocabulary", () => {
      beforeEach(() => {
        nock(testDomain)
          .get("/schema-json-custom")
          .reply(200, JSON.stringify({ $schema: customDialectId }), {
            "Content-Type": "application/schema+json"
          });
      });

      Then("it should throw an error when retrieving the schema", async () => {
        const schema = await Schema.get(`${testDomain}/schema-json-custom`);
        expect(schema.dialectId).to.equal(customDialectId);
      });
    });

    Given("a schema with a custom $schema with an unknown core vocabulary", () => {
      let schema: SchemaObject;
      beforeEach(() => {
        const customUnknownDialectId = `${testDomain}/dialect/dialect-identification/custom-unknown`;
        schema = {
          $id: customUnknownDialectId,
          $schema: customUnknownDialectId,
          $vocabulary: {
            "https://json-schema.org/draft/unknown/vocab/core": true
          }
        };
      });

      Then("it should throw an error when retrieving the schema", () => {
        expect(() => Schema.add(schema)).to.throw("Couldn't determine JSON Schema version");
      });
    });
  });

  describe("media type parameters", () => {
    Given(`a schema without $schema and media type parameter; profile="${dialectId}"`, () => {
      beforeEach(() => {
        nock(testDomain)
          .get("/schema-json-profile")
          .reply(200, JSON.stringify({}), {
            "Content-Type": `application/schema+json; profile="${dialectId}"`
          });
      });

      Then("the fetched schema should have the given dialect", async () => {
        const schema = await Schema.get(`${testDomain}/schema-json-profile`);
        expect(schema.dialectId).to.equal(dialectId);
      });
    });

    Given(`a schema without $schema and media type paramter; schema="${dialectId}"`, () => {
      beforeEach(() => {
        nock(testDomain)
          .get("/schema-json-schema")
          .reply(200, JSON.stringify({}), {
            "Content-Type": `application/schema+json; schema="${dialectId}"`
          });
      });

      Then("the fetched schema should have the given dialect", async () => {
        const schema = await Schema.get(`${testDomain}/schema-json-schema`);
        expect(schema.dialectId).to.equal(dialectId);
      });
    });

    Given(`a schema without $schema and media type paramter; schema="${customDialectId}"`, () => {
      beforeEach(() => {
        nock(testDomain)
          .get("/schema-json-schema-custom")
          .reply(200, JSON.stringify({}), {
            "Content-Type": `application/schema+json; schema="${customDialectId}"`
          });
      });

      Then("the fetched schema should have the given dialect", async () => {
        const schema = await Schema.get(`${testDomain}/schema-json-schema-custom`);
        expect(schema.dialectId).to.equal(customDialectId);
      });
    });

    Given("a schema with $schema and media type parameter", () => {
      beforeEach(() => {
        nock(testDomain)
          .get("/schema-json-schema")
          .reply(200, JSON.stringify({ $schema: dialectId }), {
            "Content-Type": `application/schema+json; schema="http://json-schema.org/draft-04/schema#"`
          });
      });

      Then("the fetched schema should have the $schema dialect", async () => {
        const schema = await Schema.get(`${testDomain}/schema-json-schema`);
        expect(schema.dialectId).to.equal(dialectId);
      });
    });
  });
});
