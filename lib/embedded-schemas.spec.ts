import { expect } from "chai";
import { Given, When, Then } from "./mocha-gherkin.spec";
import Schema from "./schema.js";
import type { SchemaDocument } from "./schema.js";


const testDomain = "http://test.jsc.hyperjump.io";

describe("Embedded schemas", () => {
  const dialectId = `${testDomain}/dialect/embedded-schemas`;
  Schema.setConfig(dialectId, "baseToken", "$id");
  Schema.setConfig(dialectId, "embeddedToken", "$id");
  Schema.setConfig(dialectId, "anchorToken", "$anchor");
  Schema.add({
    "$id": dialectId,
    "$schema": dialectId
  });

  Given("an embedded schema with an absolute URI", () => {
    beforeEach(() => {
      Schema.add({
        "$id": `${testDomain}/root`,
        "$schema": dialectId,
        "definitions": {
          "foo": {
            "$id": `${testDomain}/absolute-id`,
            "type": "string"
          }
        }
      });
    });

    When("retreiving the embedded schema using the embedded URI", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(`${testDomain}/absolute-id`);
      });

      Then("it's URI should the embedded URI", () => {
        expect(Schema.uri(subject)).to.equal(`${testDomain}/absolute-id#`);
      });
    });

    When("retreiving the embedded schema from the root schema", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(`${testDomain}/root#/definitions/foo`);
      });

      Then("it's URI should the embedded URI", () => {
        expect(Schema.uri(subject)).to.equal(`${testDomain}/absolute-id#`);
      });

      Then("it's dialectId should be inherited from the embedded URI", () => {
        expect(subject.dialectId).to.equal(dialectId);
      });
    });

    When("retreiving a fragment of the embedded schema from the root schema", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(`${testDomain}/root#/definitions/foo/type`);
      });

      Then("the embedded document should not be accessible", () => {
        expect(Schema.value(subject)).to.equal(undefined);
      });
    });
  });

  Given("an embedded schema with a relative URI", () => {
    beforeEach(() => {
      Schema.add({
        "$id": `${testDomain}/root`,
        "$schema": dialectId,
        "definitions": {
          "foo": {
            "$id": "relative-id",
            "type": "string"
          }
        }
      });
    });

    When("retreiving the embedded schema using the embedded URI", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(`${testDomain}/relative-id`);
      });

      Then("it's URI should the embedded id resolved against the embedded URI", () => {
        expect(Schema.uri(subject)).to.equal(`${testDomain}/relative-id#`);
      });
    });
  });

  Given("an embedded schema with a different dialectId than the parent schema", () => {
    const embeddedDialectId = `${testDomain}/dialect/embedded-schemas/embedded1`;
    Schema.setConfig(embeddedDialectId, "baseToken", "$id");
    Schema.setConfig(embeddedDialectId, "embeddedToken", "$id");
    Schema.add({
      "$id": embeddedDialectId,
      "$schema": embeddedDialectId
    });

    Schema.add({
      "$id": `${testDomain}/root`,
      "$schema": dialectId,
      "definitions": {
        "foo": {
          "$id": `${testDomain}/switching-schema-version`,
          "$schema": embeddedDialectId,
          "type": "string"
        }
      }
    });

    When("retreiving the embedded schema using the embedded URI", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(`${testDomain}/switching-schema-version`);
      });

      Then("it's dialectId should change to the embedded schema", () => {
        expect(subject.dialectId).to.equal(embeddedDialectId);
      });
    });
  });

  Given("an embedded schema with a different embeddedToken than the parent schema", () => {
    const embeddedDialectId = `${testDomain}/dialect/embedded-schemas/embedded2`;
    Schema.setConfig(embeddedDialectId, "baseToken", "id");
    Schema.setConfig(embeddedDialectId, "embeddedToken", "id");
    Schema.setConfig(embeddedDialectId, "anchorToken", "id");
    Schema.add({
      "id": embeddedDialectId,
      "$schema": embeddedDialectId
    });

    Schema.add({
      "$id": `${testDomain}/root`,
      "$schema": dialectId,
      "definitions": {
        "foo": {
          "id": `${testDomain}/switching-id-token#foo`,
          "$schema": embeddedDialectId,
          "type": "string"
        }
      }
    });

    When("retreiving the embedded schema using the embedded URI", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(`${testDomain}/switching-id-token`);
      });

      Then("it's URI should the embedded URI", () => {
        expect(Schema.uri(subject)).to.equal(`${testDomain}/switching-id-token#`);
      });

      Then("it's dialectId should change to the embedded schema", () => {
        expect(subject.dialectId).to.equal(embeddedDialectId);
      });
    });

    When("retreiving the embedded schema using the embedded anchor", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(`${testDomain}/switching-id-token#foo`);
      });

      Then("it's URI should the embedded URI", () => {
        expect(Schema.uri(subject)).to.equal(`${testDomain}/switching-id-token#`);
      });

      Then("it's dialectId should change to the embedded schema", () => {
        expect(subject.dialectId).to.equal(embeddedDialectId);
      });
    });
  });

  Given("an embedded schema with an anchor that should only be understood by the parent", () => {
    const embeddedDialectId = `${testDomain}/dialect/embedded-schemas/embedded3`;
    Schema.setConfig(embeddedDialectId, "baseToken", "id");
    Schema.setConfig(embeddedDialectId, "embeddedToken", "id");
    Schema.add({
      "id": embeddedDialectId,
      "$schema": embeddedDialectId
    });

    Schema.add({
      "$id": `${testDomain}/root`,
      "$schema": dialectId,
      "definitions": {
        "foo": {
          "id": `${testDomain}/wrong-anchor-token`,
          "$schema": embeddedDialectId,
          "$anchor": "foo",
          "type": "string"
        }
      }
    });

    When("retreiving the embedded schema using the embedded anchor", () => {
      Then("foo", () => {
        Schema.get(`${testDomain}/wrong-anchor-token#foo`)
          .then(() => expect.fail())
          .catch((error) => expect(error).to.be.an("error"));
      });
    });
  });
});
