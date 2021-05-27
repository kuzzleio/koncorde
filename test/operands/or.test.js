const should = require('should/as-function');
const DSL = require('../../');

describe('DSL.operands.or', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => dsl.validate({or: []}))
        .throw('Attribute "or" cannot be empty');
    });

    it('should reject non-array content', () => {
      should(() => dsl.validate({or: {foo: 'bar'}}))
        .throw('Attribute "or" must be an array');
    });

    it('should reject if one of the content is not an object', () => {
      const filter = {
        or: [
          {equals: {foo: 'bar'}},
          [ {exists: {field: 'foo'}} ],
        ],
      };

      should(() => dsl.validate(filter))
        .throw('"or" operand can only contain non-empty objects');
    });

    it('should reject if one of the content object does not refer to a valid keyword', () => {
      const filter = {
        or: [
          {equals: {foo: 'bar'}},
          {foo: 'bar'},
        ],
      };

      should(() => dsl.validate(filter)).throw('Unknown DSL keyword: foo');
    });

    it('should reject if one of the content object is not a well-formed keyword', () => {
      const filter = {
        or: [
          {equals: {foo: 'bar'}},
          {exists: {foo: 'bar'}},
        ],
      };

      should(() => dsl.validate(filter))
        .throw('"exists" requires the following attribute: field');
    });

    it('should validate a well-formed "or" operand', () => {
      const filters = {
        or: [
          {equals: {foo: 'bar'}},
          {exists: {field: 'bar'}},
        ],
      };

      should(() => dsl.validate(filters)).not.throw();
    });
  });

  describe('#matching', () => {
    it('should match a document if at least 1 condition is fulfilled', () => {
      const subscription = dsl.register('index', 'collection', {
        or: [
          {equals: {foo: 'bar'}},
          {missing: {field: 'bar'}},
          {range: {baz: {lt: 42}}},
        ],
      });

      const result = dsl.test('index', 'collection', {
        foo: 'foo',
        bar: 'baz',
        baz: 13,
      });

      should(result).eql([subscription.id]);
    });

    it('should not match if the document misses all conditions', () => {
      dsl.register('index', 'collection', {
        or: [
          {equals: {foo: 'bar'}},
          {missing: {field: 'bar'}},
          {range: {baz: {lt: 42}}},
        ],
      });

      should(dsl.test('index', 'collection', {foo: 'foo', bar: 'baz', baz: 42}))
        .be.an.Array().and.empty();
    });
  });

  describe('#removal', () => {
    it('should destroy all associated keywords to an OR operand', () => {
      const subscription = dsl.register('index', 'collection', {
        or: [
          {equals: {foo: 'bar'}},
          {missing: {field: 'bar'}},
          {range: {baz: {lt: 42}}},
        ],
      });

      dsl.register('index', 'collection', {exists: {field: 'foo'}});

      dsl.remove(subscription.id);

      should(dsl.storage.foPairs.get('index', 'collection', 'exists')).be.an.Object();
      should(dsl.storage.foPairs.get('index', 'collection', 'equals')).be.undefined();
      should(dsl.storage.foPairs.get('index', 'collection', 'notexists')).be.undefined();
      should(dsl.storage.foPairs.get('index', 'collection', 'range')).be.undefined();
    });
  });
});
