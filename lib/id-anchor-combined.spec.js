const { expect } = require("chai");
const { Given, When, Then } = require("./mocha-gherkin.spec.js");
const Schema = require("./schema");


describe("Combined anchor and id", () => {
  const testDomain = "http://test.jsc.hyperjump.io";
  const schemaVersion = `${testDomain}/draft-test/schema`;

  before(() => {
    Schema.setConfig(schemaVersion, "idToken", "$id");
    Schema.setConfig(schemaVersion, "anchorToken", "$id");
  });

  Given("A schema with an anchor id", () => {
    const id = `${testDomain}/just-anchor`;
    beforeEach(() => {
      Schema.add({
        "$id": id,
        "$schema": schemaVersion,
        "definitions": {
          "foo": {
            "$id": "#foo",
            "type": "string"
          }
        }
      });
    });

    When("retreiving the schema by anchor", () => {
      let subject;
      beforeEach(async () => {
        subject = await Schema.get(`${id}#foo`);
      });

      Then("it's URI should have a JSON Pointer", () => {
        expect(Schema.uri(subject)).to.equal(`${id}#/definitions/foo`);
      });
    });

    When("retreiving the schema by a nonexistent anchor", () => {
      Then("it should throw an error", async () => {
        try {
          await Schema.get(`${id}#bar`);
        } catch (error) {
          expect(error).to.be.an("error");
          return;
        }
        expect.fail();
      });
    });
  });

  Given("A schema with an id that is also an anchor", () => {
    const id = `${testDomain}/id-and-anchor`;
    beforeEach(() => {
      Schema.add({
        "$id": id,
        "$schema": schemaVersion,
        "definitions": {
          "foo": {
            "$id": "foo#foo",
            "type": "string"
          }
        }
      });
    });

    When("retreiving the schema by anchor", () => {
      let subject;
      beforeEach(async () => {
        subject = await Schema.get(`${testDomain}/foo#foo`);
      });

      Then("it's URI should have a JSON Pointer", () => {
        expect(Schema.uri(subject)).to.equal(`${testDomain}/foo#`);
      });
    });
  });
});
