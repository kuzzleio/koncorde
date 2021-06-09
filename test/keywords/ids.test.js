const should = require('should/as-function');
const { Koncorde } = require('../../');

describe('DSL.keyword.ids', () => {
  let koncorde;

  beforeEach(() => {
    koncorde = new Koncorde();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => koncorde.validate({ids: {}}))
        .throw('"ids" must be a non-empty object');
    });

    it('should reject filters with other fields other than the "values" one', () => {
      should(() => koncorde.validate({ids: {foo: ['foo']}}))
        .throw('"ids" requires the following attribute: values');
    });

    it('should reject filters with multiple defined attributes', () => {
      should(() => koncorde.validate({ids: {values: ['foo'], foo: ['foo']}}))
        .throw('"ids" can contain only one attribute');
    });

    it('should reject filters with an empty value list', () => {
      should(() => koncorde.validate({ids: {values: []}}))
        .throw('Attribute "values" in "ids" cannot be empty');
    });

    it('should reject filters with non-array values attribute', () => {
      should(() => koncorde.validate({ids: {values: 'foo'}}))
        .throw('Attribute "values" in "ids" must be an array');
    });

    it('should reject filters containing a non-string value', () => {
      should(() => koncorde.validate({ids: {values: ['foo', 'bar', 42, 'baz']}}))
        .throw('Array "values" in keyword "ids" can only contain strings');
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
