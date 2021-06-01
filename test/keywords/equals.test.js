const should = require('should/as-function');

const FieldOperand = require('../../lib/engine/objects/fieldOperand');
const { Koncorde } = require('../../');

describe('Koncorde.keyword.equals', () => {
  let koncorde;
  let engine;

  beforeEach(() => {
    koncorde = new Koncorde();
    engine = koncorde.engines.get(null);
  });

  function getSubfilter(id) {
    return Array.from(engine.filters.get(id).subfilters)[0];
  }

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => koncorde.validate({equals: ['foo', 'bar']}))
        .throw('"equals" must be a non-empty object');
    });

    it('should reject filters with more than 1 field', () => {
      should(() => koncorde.validate({equals: {foo: 'foo', bar: 'bar'}}))
        .throw('"equals" can contain only one attribute');
    });

    it('should reject filters with array argument', () => {
      should(() => koncorde.validate({equals: {foo: ['bar']}}))
        .throw('"foo" in "equals" must be either a string, a number, a boolean or null');
    });

    it('should validate filters with number argument', () => {
      should(() => koncorde.validate({equals: {foo: 42}})).not.throw();
    });

    it('should reject filters with object argument', () => {
      should(() => koncorde.validate({equals: {foo: {}}}))
        .throw('"foo" in "equals" must be either a string, a number, a boolean or null');
    });

    it('should reject filters with undefined argument', () => {
      should(() => koncorde.validate({equals: {foo: undefined}}))
        .throw('"foo" in "equals" must be either a string, a number, a boolean or null');
    });

    it('should validate filters with null argument', () => {
      should(() => koncorde.validate({equals: {foo: null}})).not.throw();
    });

    it('should validate filters with boolean argument', () => {
      should(() => koncorde.validate({equals: {foo: true}})).not.throw();
    });

    it('should validate filters with a string argument', () => {
      should(() => koncorde.validate({equals: {foo: 'bar'}})).not.throw();
    });

    it('should validate filters with an empty string argument', () => {
      should(() => koncorde.validate({equals: {foo: ''}})).not.throw();
    });
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      should(koncorde.transformer.standardizer.standardize({equals: {foo: 'bar'}}))
        .match({equals: {foo: 'bar'}});
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      const id = koncorde.register({ equals: { foo: 'bar' } });
      const subfilter = getSubfilter(id);
      const storage = engine.foPairs.get('equals');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo'))
        .instanceOf(Map)
        .have.value('bar', new Set([subfilter]));
    });

    it('should store multiple conditions on the same field correctly', () => {
      const id1 = koncorde.register({ equals: {foo: 'bar'} });
      const id2 = koncorde.register({equals: {foo: 'qux'}});

      const barSubfilter = getSubfilter(id1);
      const quxSubfilter = getSubfilter(id2);
      const equals = engine.foPairs.get('equals');

      should(equals).be.an.instanceof(FieldOperand);
      should(equals.fields.get('foo'))
        .have.value('bar', new Set([barSubfilter]));
      should(equals.fields.get('foo'))
        .have.value('qux', new Set([quxSubfilter]));
    });

    it('should store multiple subfilters on the same condition correctly', () => {
      const id1 = koncorde.register({ equals: {foo: 'bar'} });
      const id2 = koncorde.register({
        and: [
          { equals: { baz: 'qux' } },
          { equals: { foo: 'bar' } }
        ]
      });

      const barSubfilter = getSubfilter(id1);
      const multiSubfilter = getSubfilter(id2);
      const equals = engine.foPairs.get('equals');

      should(equals).be.an.instanceof(FieldOperand);
      should(equals.fields.get('foo'))
        .have.value('bar', new Set([barSubfilter, multiSubfilter]));
      should(equals.fields.get('baz'))
        .have.value('qux', new Set([multiSubfilter]));
    });
  });

  describe('#matching', () => {
    it('should match a document with the subscribed keyword', () => {
      const id = koncorde.register({ equals: {foo: 'bar'} });
      const result = koncorde.test({foo: 'bar'});

      should(result).be.an.Array().and.not.empty();
      should(result[0]).be.eql(id);
    });

    it('should not match if the document contains the field with another value', () => {
      koncorde.register({ equals: { foo: 'bar' } });

      should(koncorde.test({foo: 'qux'})).be.an.Array().and.be.empty();
    });

    it('should not match if the document contains another field with the registered value', () => {
      koncorde.register({ equals: { foo: 'bar' } });
      should(koncorde.test({ qux: 'bar' })).be.an.Array().and.be.empty();
    });

    // see https://github.com/kuzzleio/koncorde/issues/13
    it('should skip the matching if the document tested property is not of the same type than the known values', () => {
      koncorde.register({ equals: { foo: 'bar' } });

      should(koncorde.test({ foo: [ 'bar' ] })).be.an.Array().and.empty();

      should(koncorde.test({ foo: { bar: true } })).be.an.Array().and.empty();
    });

    it('should match a document with the subscribed nested keyword', () => {
      const id = koncorde.register({ equals: {'foo.bar.baz': 'qux'} });
      const result = koncorde.test({ foo: { bar: { baz: 'qux' } } });

      should(result).be.an.Array().and.not.empty();
      should(result[0]).be.eql(id);
    });

    it('should match 0 equality', () => {
      koncorde.register({ equals: { a: 0 } });
      should(koncorde.test({ a: 0 })).be.an.Array().length(1);
    });

    it('should match false equality', () => {
      koncorde.register({ equals: { a: false } });
      should(koncorde.test({ a: false })).be.an.Array().length(1);
    });

    it('should match null equality', () => {
      koncorde.register({ equals: { a: null } });
      should(koncorde.test({ a: null })).be.an.Array().length(1);
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const id = koncorde.register({ equals: { foo: 'bar' } });

      koncorde.remove(id);

      should(engine.foPairs).be.an.Object().and.be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const id1 = koncorde.register({ equals: { foo: 'bar' } });
      const id2 = koncorde.register({
        and: [
          { equals: { baz: 'qux' } },
          { equals: { foo: 'bar' } },
        ],
      });

      koncorde.remove(id1);

      const equals = engine.foPairs.get('equals');
      const multiSubfilter = getSubfilter(id2);

      should(equals).be.an.instanceof(FieldOperand);
      should(equals.fields.get('foo'))
        .have.value('bar', new Set([multiSubfilter]));
      should(equals.fields.get('baz'))
        .have.value('qux', new Set([multiSubfilter]));
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      const id1 = koncorde.register({ equals: { foo: 'bar' } });
      const id2 = koncorde.register({ equals: { foo: 'qux' } });

      const equals = engine.foPairs.get('equals');
      const barSubfilter = getSubfilter(id1);

      should(equals.fields.get('foo').get('bar')).eql(new Set([barSubfilter]));

      should(equals.fields.get('foo').get('qux'))
        .eql(new Set([getSubfilter(id2)]));

      koncorde.remove(id2);

      should(equals).be.an.instanceof(FieldOperand);
      should(equals.fields.get('foo'))
        .have.value('bar', new Set([barSubfilter]))
        .not.have.key('qux');
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      const id1 = koncorde.register({ equals: { foo: 'bar' } });
      const id2 = koncorde.register({ equals: { baz: 'qux' } });

      const barSubfilter = getSubfilter(id1);
      const equals = engine.foPairs.get('equals');

      should(equals.fields.get('baz'))
        .have.value('qux', new Set([getSubfilter(id2)]));

      koncorde.remove(id2);

      should(equals).be.an.instanceof(FieldOperand);

      should(equals.fields.get('foo'))
        .have.value('bar', new Set([barSubfilter]));

      should(equals.fields).not.have.key('baz');
    });
  });
});
