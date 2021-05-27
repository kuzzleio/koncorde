const should = require('should/as-function');
const DSL = require('../../');

describe('DSL.keyword.ids', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(dsl.validate({ids: {}}))
        .be.rejectedWith('"ids" must be a non-empty object');
    });

    it('should reject filters with other fields other than the "values" one', () => {
      return should(dsl.validate({ids: {foo: ['foo']}}))
        .be.rejectedWith('"ids" requires the following attribute: values');
    });

    it('should reject filters with multiple defined attributes', () => {
      return should(dsl.validate({ids: {values: ['foo'], foo: ['foo']}}))
        .be.rejectedWith('"ids" can contain only one attribute');
    });

    it('should reject filters with an empty value list', () => {
      return should(dsl.validate({ids: {values: []}}))
        .be.rejectedWith('Attribute "values" in "ids" cannot be empty');
    });

    it('should reject filters with non-array values attribute', () => {
      return should(dsl.validate({ids: {values: 'foo'}}))
        .be.rejectedWith('Attribute "values" in "ids" must be an array');
    });

    it('should reject filters containing a non-string value', () => {
      return should(dsl.validate({ids: {values: ['foo', 'bar', 42, 'baz']}}))
        .be.rejectedWith('Array "values" in keyword "ids" can only contain strings');
    });

    it('should validate a well-formed ids filter', () => {
      return should(dsl.validate({ids: {values: ['foo', 'bar', 'baz']}}))
        .be.fulfilled();
    });
  });

  describe('#standardization', () => {
    it('should return a list of "equals" conditions in a "or" operand', () => {
      should(dsl.transformer.standardizer.standardize({ids: {values: ['foo', 'bar', 'baz']}}))
        .match({or: [
          {equals: {_id: 'foo'}},
          {equals: {_id: 'bar'}},
          {equals: {_id: 'baz'}}
        ]});
    });
  });
});
