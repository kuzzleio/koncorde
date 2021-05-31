const should = require('should/as-function');
const Koncorde = require('../../');

describe('Koncorde.keyword.in', () => {
  let koncorde;

  beforeEach(() => {
    koncorde = new Koncorde();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => koncorde.validate({in: {}}))
        .throw('"in" must be a non-empty object');
    });

    it('should reject filters with multiple defined attributes', () => {
      should(() => koncorde.validate({in: {bar: ['foo'], foo: ['foo']}}))
        .throw('"in" can contain only one attribute');
    });

    it('should reject filters with an empty value list', () => {
      should(() => koncorde.validate({in: {foo: []}}))
        .throw('Attribute "foo" in "in" cannot be empty');
    });

    it('should reject filters with non-array values attribute', () => {
      should(() => koncorde.validate({in: {foo: 'foo'}}))
        .throw('Attribute "foo" in "in" must be an array');
    });

    it('should reject filters containing a non-string value', () => {
      should(() => koncorde.validate({in: {foo: ['foo', 'bar', 42, 'baz']}}))
        .throw('Array "foo" in keyword "in" can only contain strings');
    });

    it('should validate a well-formed ids filter', () => {
      should(() => koncorde.validate({in: {foo: ['foo', 'bar', 'baz']}}))
        .not.throw();
    });
  });

  describe('#standardization', () => {
    it('should return a list of "equals" conditions in a "or" operand', () => {
      should(koncorde.transformer.standardizer.standardize({in: {foo: ['foo', 'bar', 'baz']}}))
        .match({or: [
          {equals: {foo: 'foo'}},
          {equals: {foo: 'bar'}},
          {equals: {foo: 'baz'}}
        ]});
    });
  });
});
