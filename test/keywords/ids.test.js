const should = require('should/as-function');
const DSL = require('../../');

describe('DSL.keyword.ids', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => dsl.validate({ids: {}}))
        .throw('"ids" must be a non-empty object');
    });

    it('should reject filters with other fields other than the "values" one', () => {
      should(() => dsl.validate({ids: {foo: ['foo']}}))
        .throw('"ids" requires the following attribute: values');
    });

    it('should reject filters with multiple defined attributes', () => {
      should(() => dsl.validate({ids: {values: ['foo'], foo: ['foo']}}))
        .throw('"ids" can contain only one attribute');
    });

    it('should reject filters with an empty value list', () => {
      should(() => dsl.validate({ids: {values: []}}))
        .throw('Attribute "values" in "ids" cannot be empty');
    });

    it('should reject filters with non-array values attribute', () => {
      should(() => dsl.validate({ids: {values: 'foo'}}))
        .throw('Attribute "values" in "ids" must be an array');
    });

    it('should reject filters containing a non-string value', () => {
      should(() => dsl.validate({ids: {values: ['foo', 'bar', 42, 'baz']}}))
        .throw('Array "values" in keyword "ids" can only contain strings');
    });

    it('should validate a well-formed ids filter', () => {
      should(() => dsl.validate({ids: {values: ['foo', 'bar', 'baz']}}))
        .not.throw();
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
