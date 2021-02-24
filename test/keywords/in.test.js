const should = require('should/as-function');
const { BadRequestError } = require('kuzzle-common-objects');
const DSL = require('../../');

describe('DSL.keyword.in', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(dsl.validate({in: {}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with multiple defined attributes', () => {
      return should(dsl.validate({in: {bar: ['foo'], foo: ['foo']}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with an empty value list', () => {
      return should(dsl.validate({in: {foo: []}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with non-array values attribute', () => {
      return should(dsl.validate({in: {foo: 'foo'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters containing a non-string value', () => {
      return should(dsl.validate({in: {foo: ['foo', 'bar', 42, 'baz']}})).be.rejectedWith(BadRequestError);
    });

    it('should validate a well-formed ids filter', () => {
      return should(dsl.validate({in: {foo: ['foo', 'bar', 'baz']}})).be.fulfilledWith();
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
