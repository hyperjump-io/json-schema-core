import { expect } from "chai";
import { Given, When, Then } from "./mocha-gherkin.spec";
import Schema from "./schema.js";
import type { SchemaDocument } from "./schema.js";


describe("Embedded schemas", () => {
  const testDomain = "http://test.jsc.hyperjump.io";
  const schemaVersion = `${testDomain}/draft-test/schema`;

  before(() => {
    Schema.setConfig(schemaVersion, "baseToken", "$id");
    Schema.setConfig(schemaVersion, "embeddedToken", "$id");
    Schema.setConfig(schemaVersion, "anchorToken", "$anchor");
  });

  Given("an embedded schema with an absolute URI", () => {
    beforeEach(() => {
      Schema.add({
        "$id": `${testDomain}/root`,
        "$schema": schemaVersion,
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

      Then("it's schemaVersion should be inherited from the embedded URI", () => {
        expect(subject.schemaVersion).to.equal(schemaVersion);
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
        "$schema": schemaVersion,
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

  Given("an embedded schema with a different schemaVersion than the parent schema", () => {
    const embeddedSchemaVersion = `${testDomain}/draft-embedded/schema`;

    beforeEach(() => {
      Schema.setConfig(embeddedSchemaVersion, "baseToken", "$id");
      Schema.setConfig(embeddedSchemaVersion, "embeddedToken", "$id");

      Schema.add({
        "$id": `${testDomain}/root`,
        "$schema": schemaVersion,
        "definitions": {
          "foo": {
            "$id": `${testDomain}/switching-schema-version`,
            "$schema": embeddedSchemaVersion,
            "type": "string"
          }
        }
      });
    });

    When("retreiving the embedded schema using the embedded URI", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(`${testDomain}/switching-schema-version`);
      });

      Then("it's schemaVersion should change to the embedded schema", () => {
        expect(subject.schemaVersion).to.equal(embeddedSchemaVersion);
      });
    });
  });

  Given("an embedded schema with a different embeddedToken than the parent schema", () => {
    const embeddedSchemaVersion = `${testDomain}/draft-embedded/schema`;

    beforeEach(() => {
      Schema.setConfig(embeddedSchemaVersion, "baseToken", "id");
      Schema.setConfig(embeddedSchemaVersion, "embeddedToken", "id");
      Schema.setConfig(embeddedSchemaVersion, "anchorToken", "id");

      Schema.add({
        "$id": `${testDomain}/root`,
        "$schema": schemaVersion,
        "definitions": {
          "foo": {
            "id": `${testDomain}/switching-id-token#foo`,
            "$schema": embeddedSchemaVersion,
            "type": "string"
          }
        }
      });
    });

    When("retreiving the embedded schema using the embedded URI", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(`${testDomain}/switching-id-token`);
      });

      Then("it's URI should the embedded URI", () => {
        expect(Schema.uri(subject)).to.equal(`${testDomain}/switching-id-token#`);
      });

      Then("it's schemaVersion should change to the embedded schema", () => {
        expect(subject.schemaVersion).to.equal(embeddedSchemaVersion);
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

      Then("it's schemaVersion should change to the embedded schema", () => {
        expect(subject.schemaVersion).to.equal(embeddedSchemaVersion);
      });
    });
  });

  Given("an embedded schema with an anchor that should only be understood by the parent", () => {
    const embeddedSchemaVersion = `${testDomain}/draft-embedded/schema`;

    beforeEach(() => {
      Schema.setConfig(embeddedSchemaVersion, "baseToken", "id");
      Schema.setConfig(embeddedSchemaVersion, "embeddedToken", "id");

      Schema.add({
        "$id": `${testDomain}/root`,
        "$schema": schemaVersion,
        "definitions": {
          "foo": {
            "id": `${testDomain}/wrong-anchor-token`,
            "$schema": embeddedSchemaVersion,
            "$anchor": "foo",
            "type": "string"
          }
        }
      });
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
