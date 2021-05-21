const should = require('should/as-function');
const DSL = require('../../');

describe('DSL.keyword.in', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(dsl.validate({in: {}}))
        .be.rejectedWith('"in" must be a non-empty object');
    });

    it('should reject filters with multiple defined attributes', () => {
      return should(dsl.validate({in: {bar: ['foo'], foo: ['foo']}}))
        .be.rejectedWith('"in" can contain only one attribute');
    });

    it('should reject filters with an empty value list', () => {
      return should(dsl.validate({in: {foo: []}}))
        .be.rejectedWith('Attribute "foo" in "in" cannot be empty');
    });

    it('should reject filters with non-array values attribute', () => {
      return should(dsl.validate({in: {foo: 'foo'}}))
        .be.rejectedWith('Attribute "foo" in "in" must be an array');
    });

    it('should reject filters containing a non-string value', () => {
      return should(dsl.validate({in: {foo: ['foo', 'bar', 42, 'baz']}}))
        .be.rejectedWith('Array "foo" in keyword "in" can only contain strings');
    });

    it('should validate a well-formed ids filter', () => {
      return should(dsl.validate({in: {foo: ['foo', 'bar', 'baz']}}))
        .be.fulfilled();
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
