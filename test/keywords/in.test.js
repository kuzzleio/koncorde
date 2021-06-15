const should = require('should/as-function');
const { Koncorde } = require('../../');

describe('Koncorde.keyword.in', () => {
  let koncorde;

  beforeEach(() => {
    koncorde = new Koncorde();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => koncorde.validate({in: {}}))
        .throw({
          keyword: 'in',
          message: '"in": expected object to have exactly 1 property, got 0',
          path: 'in',
        });
    });

    it('should reject filters with multiple defined attributes', () => {
      should(() => koncorde.validate({in: {bar: ['foo'], foo: ['foo']}}))
        .throw({
          keyword: 'in',
          message: '"in": expected object to have exactly 1 property, got 2',
          path: 'in',
        });
    });

    it('should reject filters with an empty value list', () => {
      should(() => koncorde.validate({in: {foo: []}}))
        .throw({
          keyword: 'in',
          message: '"in.foo": cannot be empty',
          path: 'in.foo',
        });
    });

    it('should reject filters with non-array values attribute', () => {
      should(() => koncorde.validate({in: {foo: 'foo'}}))
        .throw({
          keyword: 'in',
          message: '"in.foo": must be an array',
          path: 'in.foo',
        });
    });

    it('should reject filters containing a non-string value', () => {
      should(() => koncorde.validate({in: {foo: ['foo', 'bar', 42, 'baz']}}))
        .throw({
          keyword: 'in',
          message: '"in.foo": must hold only values of type "string"',
          path: 'in.foo',
        });
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
