import { expect } from "chai";
import { Given, When, Then } from "./mocha-gherkin.spec";
import Schema from "./schema.js";
import type { SchemaDocument } from "./schema.js";


describe("Combined anchor and id", () => {
  const testDomain = "http://test.jsc.hyperjump.io";
  const dialectId = `${testDomain}/draft-test/schema`;

  before(() => {
    Schema.setConfig(dialectId, "baseToken", "$id");
    Schema.setConfig(dialectId, "embeddedToken", "$id");
    Schema.setConfig(dialectId, "anchorToken", "$id");
  });

  Given("A schema with an anchor id", () => {
    const id = `${testDomain}/just-anchor`;
    beforeEach(() => {
      Schema.add({
        "$id": id,
        "$schema": dialectId,
        "definitions": {
          "foo": {
            "$id": "#foo",
            "type": "string"
          }
        }
      });
    });

    When("retreiving the schema by anchor", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(`${id}#foo`);
      });

      Then("it's URI should have a JSON Pointer", () => {
        expect(Schema.uri(subject)).to.equal(`${id}#/definitions/foo`);
      });
    });

    When("retreiving the schema by a nonexistent anchor", () => {
      Then("it should throw an error", () => {
        Schema.get(`${id}#bar`)
          .then(() => expect.fail())
          .catch((error) => expect(error).to.be.an("error"));
      });
    });
  });

  Given("A schema with an id that is also an anchor", () => {
    const id = `${testDomain}/id-and-anchor`;
    beforeEach(() => {
      Schema.add({
        "$id": id,
        "$schema": dialectId,
        "definitions": {
          "foo": {
            "$id": "foo#foo",
            "type": "string"
          }
        }
      });
    });

    When("retreiving the schema by anchor", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(`${testDomain}/foo#foo`);
      });

      Then("it's URI should have a JSON Pointer", () => {
        expect(Schema.uri(subject)).to.equal(`${testDomain}/foo#`);
      });
    });
  });
});
