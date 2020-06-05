const $__value = Symbol("$__value");
const $__href = Symbol("$__href");
const $__isDynamic = Symbol("$__isDynamic");

const cons = (href, value, isDynamic = false) => Object.freeze({
  [$__href]: href,
  [$__value]: value,
  [$__isDynamic]: isDynamic
});

const isReference = (ref) => ref && ref[$__href] !== undefined;
const href = (ref) => ref[$__href];
const value = (ref) => ref[$__value];
const isDynamic = (ref) => ref[$__isDynamic];

module.exports = { cons, isReference, href, value, isDynamic };
