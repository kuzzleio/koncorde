const should = require('should/as-function');
const { Koncorde } = require('../../');

describe('Koncorde.keyword.ids', () => {
  let koncorde;

  beforeEach(() => {
    koncorde = new Koncorde();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => koncorde.validate({ids: {}}))
        .throw({
          keyword: 'ids',
          message: '"ids": expected object to have exactly 1 property, got 0',
          path: 'ids',
        });
    });

    it('should reject filters with other fields other than the "values" one', () => {
      should(() => koncorde.validate({ids: {foo: ['foo']}}))
        .throw({
          keyword: 'ids',
          message: '"ids": the property "values" is missing',
          path: 'ids',
        });
    });

    it('should reject filters with multiple defined attributes', () => {
      should(() => koncorde.validate({ids: {values: ['foo'], foo: ['foo']}}))
        .throw({
          keyword: 'ids',
          message: '"ids": expected object to have exactly 1 property, got 2',
          path: 'ids',
        });
    });

    it('should reject filters with an empty value list', () => {
      should(() => koncorde.validate({ids: {values: []}}))
        .throw({
          keyword: 'ids',
          message: '"ids.values": cannot be empty',
          path: 'ids.values',
        });
    });

    it('should reject filters with non-array values attribute', () => {
      should(() => koncorde.validate({ids: {values: 'foo'}}))
        .throw({
          keyword: 'ids',
          message: '"ids.values": must be an array',
          path: 'ids.values',
        });
    });

    it('should reject filters containing a non-string value', () => {
      should(() => koncorde.validate({ids: {values: ['foo', 'bar', 42, 'baz']}}))
        .throw({
          keyword: 'ids',
          message: '"ids.values": must hold only values of type "string"',
          path: 'ids.values',
        });
    });

    it('should validate a well-formed ids filter', () => {
      should(() => koncorde.validate({ids: {values: ['foo', 'bar', 'baz']}}))
        .not.throw();
    });
  });

  describe('#standardization', () => {
    it('should return a list of "equals" conditions in a "or" operand', () => {
      should(koncorde.transformer.standardizer.standardize({ids: {values: ['foo', 'bar', 'baz']}}))
        .match({or: [
          {equals: {_id: 'foo'}},
          {equals: {_id: 'bar'}},
          {equals: {_id: 'baz'}}
        ]});
    });
  });
});
