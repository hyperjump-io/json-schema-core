const Given = (message, fn) => describe("Given " + message, fn);
const When = (message, fn) => describe("When " + message, fn);
const Then = (message, fn) => it("Then " + message, fn);
const And = (message, fn) => describe("And " + message, fn);

module.exports = { Given, When, Then, And };
