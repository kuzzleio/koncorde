const should = require('should/as-function');
const { Koncorde } = require('../../');

describe('Koncorde.operands.or', () => {
  let koncorde;

  beforeEach(() => {
    koncorde = new Koncorde();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => koncorde.validate({or: []}))
        .throw('Attribute "or" cannot be empty');
    });

    it('should reject non-array content', () => {
      should(() => koncorde.validate({or: {foo: 'bar'}}))
        .throw('Attribute "or" must be an array');
    });

    it('should reject if one of the content is not an object', () => {
      const filter = {
        or: [
          {equals: {foo: 'bar'}},
          [ {exists: {field: 'foo'}} ],
        ],
      };

      should(() => koncorde.validate(filter))
        .throw('"or" operand can only contain non-empty objects');
    });

    it('should reject if one of the content object does not refer to a valid keyword', () => {
      const filter = {
        or: [
          { equals: { foo: 'bar' } },
          { foo: 'bar' },
        ],
      };

      should(() => koncorde.validate(filter))
        .throw('Unknown Koncorde keyword: foo');
    });

    it('should reject if one of the content object is not a well-formed keyword', () => {
      const filter = {
        or: [
          {equals: {foo: 'bar'}},
          {exists: {foo: 'bar'}},
        ],
      };

      should(() => koncorde.validate(filter))
        .throw('"exists" requires the following attribute: field');
    });

    it('should validate a well-formed "or" operand', () => {
      const filters = {
        or: [
          {equals: {foo: 'bar'}},
          {exists: {field: 'bar'}},
        ],
      };

      should(() => koncorde.validate(filters)).not.throw();
    });
  });

  describe('#matching', () => {
    it('should match a document if at least 1 condition is fulfilled', () => {
      const id = koncorde.register({
        or: [
          { equals: { foo: 'bar' } },
          { missing: { field: 'bar' } },
          { range: { baz: {lt: 42} } },
        ],
      });

      const result = koncorde.test({ foo: 'foo', bar: 'baz', baz: 13 });

      should(result).eql([id]);
    });

    it('should not match if the document misses all conditions', () => {
      koncorde.register({
        or: [
          { equals: { foo: 'bar' } },
          { missing: { field: 'bar' } },
          { range: { baz: {lt: 42} } },
        ],
      });

      should(koncorde.test({ foo: 'foo', bar: 'baz', baz: 42 }))
        .be.an.Array().and.empty();
    });
  });

  describe('#removal', () => {
    it('should destroy all associated keywords to an OR operand', () => {
      const id = koncorde.register({
        or: [
          { equals: { foo: 'bar' } },
          { missing: { field: 'bar' } },
          { range: { baz: {lt: 42} } },
        ],
      });

      koncorde.register({ exists: { field: 'foo' } });

      koncorde.remove(id);

      const engine = koncorde.engines.get(null);

      should(engine.foPairs.get('exists')).be.an.Object();
      should(engine.foPairs.get('equals')).be.undefined();
      should(engine.foPairs.get('notexists')).be.undefined();
      should(engine.foPairs.get('range')).be.undefined();
    });
  });
});
