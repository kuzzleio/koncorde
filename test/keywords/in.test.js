const should = require('should/as-function');
const DSL = require('../../');

describe('DSL.keyword.in', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => dsl.validate({in: {}}))
        .throw('"in" must be a non-empty object');
    });

    it('should reject filters with multiple defined attributes', () => {
      should(() => dsl.validate({in: {bar: ['foo'], foo: ['foo']}}))
        .throw('"in" can contain only one attribute');
    });

    it('should reject filters with an empty value list', () => {
      should(() => dsl.validate({in: {foo: []}}))
        .throw('Attribute "foo" in "in" cannot be empty');
    });

    it('should reject filters with non-array values attribute', () => {
      should(() => dsl.validate({in: {foo: 'foo'}}))
        .throw('Attribute "foo" in "in" must be an array');
    });

    it('should reject filters containing a non-string value', () => {
      should(() => dsl.validate({in: {foo: ['foo', 'bar', 42, 'baz']}}))
        .throw('Array "foo" in keyword "in" can only contain strings');
    });

    it('should validate a well-formed ids filter', () => {
      should(() => dsl.validate({in: {foo: ['foo', 'bar', 'baz']}}))
        .not.throw();
    });
  });

  describe('#standardization', () => {
    it('should return a list of "equals" conditions in a "or" operand', () => {
      should(dsl.transformer.standardizer.standardize({in: {foo: ['foo', 'bar', 'baz']}}))
        .match({or: [
          {equals: {foo: 'foo'}},
          {equals: {foo: 'bar'}},
          {equals: {foo: 'baz'}}
        ]});
    });
  });
});
