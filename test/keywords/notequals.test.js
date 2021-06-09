require('reify');

const should = require('should/as-function');
const FieldOperand = require('../../lib/engine/objects/fieldOperand');
const Koncorde = require('../../');

describe('Koncorde.keyword.notequals', () => {
  let koncorde;
  let engine;

  beforeEach(() => {
    koncorde = new Koncorde();
    engine = koncorde.engines.get(null);
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      const result = koncorde.transformer.standardizer.standardize({
        not: {
          equals: {
            foo: 'bar',
          },
        },
      });

      should(result).match({not: {equals: {foo: 'bar'}}});
    });
  });

  describe('#matching', () => {
    it('should not match a document with the subscribed keyword', () => {
      koncorde.register({ not: { equals: { foo: 'bar' } } });

      should(koncorde.test({ foo: 'bar' })).be.an.Array().and.be.empty();
    });

    it('should match if the document contains the field with another value', () => {
      const id = koncorde.register({ not: { equals: { foo: 'bar' } } });

      const result = koncorde.test({ foo: 'qux' });

      should(result).eql([id]);
    });

    it('should match if the document do not contain the registered field', () => {
      const id = koncorde.register({ not: { equals: { foo: 'bar' } } });

      const result = koncorde.test({ qux: 'bar' });

      should(result).eql([id]);
    });

    it('should match a document with the subscribed nested keyword', () => {
      const id = koncorde.register({
        not: {
          equals: {
            'foo.bar.baz': 'qux',
          },
        },
      });

      const result = koncorde.test({
        foo: {
          bar: {
            baz: 'foobar',
          },
        },
      });

      should(result).be.eql([id]);
    });

    it('should match even if another field was hit before', () => {
      koncorde.register({ not: { equals: { a: 'Jennifer Cardini' } } });
      koncorde.register({ not: { equals: { b: 'Shonky' } } });

      should(koncorde.test({ a: 'Jennifer Cardini' })).be.an.Array().length(1);
    });

    it('should match 0 equality', () => {
      koncorde.register({ not: { equals: { a: 0 } } });

      should(koncorde.test({ a: 0 })).be.an.Array().be.empty();
    });

    it('should match false equality', () => {
      koncorde.register({ not: { equals: { a: false } } });

      should(koncorde.test({ a: false })).be.an.Array().be.empty();
    });

    it('should match null equality', () => {
      koncorde.register({ not: { equals: { a: null } } });

      should(koncorde.test({ a: null })).be.an.Array().be.empty();
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const id = koncorde.register({ not: { equals: { foo: 'bar' } } });

      koncorde.remove(id);

      should(engine.foPairs).be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const id1 = koncorde.register({ not: { equals: { foo: 'bar' } } });
      const id2 = koncorde.register({
        and: [
          { not: { equals: { foo: 'qux' } } },
          { not: { equals: { foo: 'bar' } } },
        ],
      });

      const subfilter = Array.from(engine.filters.get(id2).subfilters)[0];

      koncorde.remove(id1);

      const storage = engine.foPairs.get('notequals');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo')).instanceOf(Map);
      should(storage.fields.get('foo').size).eql(2);
      should(storage.fields.get('foo').get('bar')).eql(new Set([subfilter]));
      should(storage.fields.get('foo').get('qux')).eql(new Set([subfilter]));
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      const id1 = koncorde.register({ not: { equals: { foo: 'bar' } } });
      const id2 = koncorde.register({
        and: [
          { not: { equals: { foo: 'qux' } } },
          { not: { equals: { foo: 'bar' } } },
        ],
      });


      koncorde.remove(id2);

      const storage = engine.foPairs.get('notequals');
      const barSubfilter = Array.from(engine.filters.get(id1).subfilters)[0];

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get('bar')).match(new Set([barSubfilter]));
      should(storage.fields.get('foo').get('qux')).undefined();
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      const id1 = koncorde.register({ not: { equals: { foo: 'bar' } } });
      const id2 = koncorde.register({ not: { equals: { baz: 'qux' } } });

      const barSubfilter = Array.from(engine.filters.get(id1).subfilters)[0];
      const storage = engine.foPairs.get('notequals');

      should(storage.fields).have.keys('foo', 'baz');

      koncorde.remove(id2);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get('bar')).match(new Set([barSubfilter]));
      should(storage.fields.get('baz')).be.undefined();
    });
  });
});
