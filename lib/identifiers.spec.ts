import { expect } from "chai";
import { Given, When, Then } from "./mocha-gherkin.spec";
import Schema from "./schema.js";
import type { SchemaDocument } from "./schema.js";


const testDomain = "http://test.jsc.hyperjump.io";
const dialectId = `${testDomain}/draft-test/schema`;
Schema.setConfig(dialectId, "baseToken", "$id");

describe("Identifiers", () => {
  Given("neither an internalId nor an externalId", () => {
    When("adding the schema", () => {
      let subject: () => string;
      beforeEach(() => {
        subject = () => Schema.add({ "$schema": dialectId });
      });

      Then("it should throw an error", () => {
        expect(subject).to.throw(Error, "Couldn't determine an identifier for the schema");
      });
    });
  });

  Given("an internalId with a fragment and an externalId with a fragment", () => {
    When("adding the schema", () => {
      let subject: () => string;
      beforeEach(() => {
        subject = () => Schema.add({ "$id": "#/foo", "$schema": dialectId }, "#/bar");
      });

      Then("it should throw an error", () => {
        expect(subject).to.throw(Error, "Couldn't determine an identifier for the schema");
      });
    });
  });

  Given("a schema with external id only", () => {
    const externalId = `${testDomain}/external-id`;
    beforeEach(() => {
      Schema.add({ "$schema": dialectId }, externalId);
    });

    When("retrieving the schema by it's external id", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(externalId);
      });

      Then("the schema's URI should match the given external id", () => {
        expect(Schema.uri(subject)).to.equal(`${externalId}#`);
      });
    });
  });

  Given("a schema with internal id only", () => {
    const internalId = `${testDomain}/internal-id`;
    beforeEach(() => {
      Schema.add({ "$id": internalId, "$schema": dialectId });
    });

    When("retrieving the schema by it's internal id", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(internalId);
      });

      Then("the schema's URI should match the given internal id", () => {
        expect(Schema.uri(subject)).to.equal(`${internalId}#`);
      });
    });
  });

  Given("a schema with absolute internal id and absolute external id", () => {
    const internalId = `${testDomain}/internal-id`;
    const externalId = `${testDomain}/external-id`;
    beforeEach(() => {
      Schema.add({ "$id": internalId, "$schema": dialectId }, externalId);
    });

    When("retrieving the schema by it's internal id", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(internalId);
      });

      Then("the schema's URI should match the given internal id", () => {
        expect(Schema.uri(subject)).to.equal(`${internalId}#`);
      });
    });

    When("retrieving the schema by it's external id", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(externalId);
      });

      Then("the schema's URI should match the given internal id", () => {
        expect(Schema.uri(subject)).to.equal(`${internalId}#`);
      });
    });
  });

  Given("a schema with absolute internal id and absolute external id that have fragments", () => {
    const internalId = `${testDomain}/internal-id`;
    const externalId = `${testDomain}/external-id`;
    beforeEach(() => {
      Schema.add({ "$id": `${internalId}#/foo`, "$schema": dialectId }, `${externalId}#/bar`);
    });

    When("retrieving the schema by it's internal id", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(internalId);
      });

      Then("the schema's URI should match the given internal id", () => {
        expect(Schema.uri(subject)).to.equal(`${internalId}#`);
      });
    });

    When("retrieving the schema by it's external id", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(externalId);
      });

      Then("the schema's URI should match the given internal id", () => {
        expect(Schema.uri(subject)).to.equal(`${internalId}#`);
      });
    });
  });

  Given("a schema with relative internal id and absolute external id", () => {
    const internalId = "/internal-id";
    const externalId = `${testDomain}/external-id`;
    const id = `${testDomain}/internal-id`;
    beforeEach(() => {
      Schema.add({ "$id": internalId, "$schema": dialectId }, externalId);
    });

    When("retrieving the schema by it's internal id", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(id);
      });

      Then("the schema's URI should match the given internal id", () => {
        expect(Schema.uri(subject)).to.equal(`${id}#`);
      });
    });

    When("retrieving the schema by it's external id", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(externalId);
      });

      Then("the schema's URI should match the given internal id", () => {
        expect(Schema.uri(subject)).to.equal(`${id}#`);
      });
    });
  });

  Given("a schema with IRI internal id only", () => {
    const internalId = `http://examplé.org/rosé`;
    beforeEach(() => {
      Schema.add({ "$id": internalId, "$schema": dialectId });
    });

    When("retrieving the schema by it's internal id", () => {
      let subject: SchemaDocument;
      beforeEach(async () => {
        subject = await Schema.get(internalId);
      });

      Then("the schema's URI should match the given internal id", () => {
        expect(Schema.uri(subject)).to.equal(`${internalId}#`);
      });
    });
  });
});
