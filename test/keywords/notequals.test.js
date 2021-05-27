require('reify');

const should = require('should/as-function');
const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const DSL = require('../../');

describe('DSL.keyword.notequals', () => {
  let dsl;
  let filters;
  let foPairs;

  beforeEach(() => {
    dsl = new DSL();
    filters = dsl.storage.filters;
    foPairs = dsl.storage.foPairs;
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      const result = dsl.transformer.standardizer.standardize({
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
      dsl.register({ not: { equals: { foo: 'bar' } } });

      should(dsl.test({ foo: 'bar' })).be.an.Array().and.be.empty();
    });

    it('should match if the document contains the field with another value', () => {
      const id = dsl.register({ not: { equals: { foo: 'bar' } } });

      const result = dsl.test({ foo: 'qux' });

      should(result).eql([id]);
    });

    it('should match if the document do not contain the registered field', () => {
      const id = dsl.register({ not: { equals: { foo: 'bar' } } });

      const result = dsl.test({ qux: 'bar' });

      should(result).eql([id]);
    });

    it('should match a document with the subscribed nested keyword', () => {
      const id = dsl.register({
        not: {
          equals: {
            'foo.bar.baz': 'qux',
          },
        },
      });

      const result = dsl.test({
        foo: {
          bar: {
            baz: 'foobar',
          },
        },
      });

      should(result).be.eql([id]);
    });

    it('should match even if another field was hit before', () => {
      dsl.register({ not: { equals: { a: 'Jennifer Cardini' } } });
      dsl.register({ not: { equals: { b: 'Shonky' } } });

      should(dsl.test({ a: 'Jennifer Cardini' })).be.an.Array().length(1);
    });

    it('should match 0 equality', () => {
      dsl.register({ not: { equals: { a: 0 } } });

      should(dsl.test({ a: 0 })).be.an.Array().be.empty();
    });

    it('should match false equality', () => {
      dsl.register({ not: { equals: { a: false } } });

      should(dsl.test({ a: false })).be.an.Array().be.empty();
    });

    it('should match null equality', () => {
      dsl.register({ not: { equals: { a: null } } });

      should(dsl.test({ a: null })).be.an.Array().be.empty();
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const id = dsl.register({ not: { equals: { foo: 'bar' } } });

      dsl.remove(id);

      should(foPairs).be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const id1 = dsl.register({ not: { equals: { foo: 'bar' } } });
      const id2 = dsl.register({
        and: [
          { not: { equals: { foo: 'qux' } } },
          { not: { equals: { foo: 'bar' } } },
        ],
      });

      const subfilter = Array.from(filters.get(id2).subfilters)[0];

      dsl.remove(id1);

      const storage = foPairs.get('notequals');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo')).instanceOf(Map);
      should(storage.fields.get('foo').size).eql(2);
      should(storage.fields.get('foo').get('bar')).eql(new Set([subfilter]));
      should(storage.fields.get('foo').get('qux')).eql(new Set([subfilter]));
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      const id1 = dsl.register({ not: { equals: { foo: 'bar' } } });
      const id2 = dsl.register({
        and: [
          { not: { equals: { foo: 'qux' } } },
          { not: { equals: { foo: 'bar' } } },
        ],
      });


      dsl.remove(id2);

      const storage = foPairs.get('notequals');
      const barSubfilter = Array.from(filters.get(id1).subfilters)[0];

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get('bar')).match(new Set([barSubfilter]));
      should(storage.fields.get('foo').get('qux')).undefined();
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      const id1 = dsl.register({ not: { equals: { foo: 'bar' } } });
      const id2 = dsl.register({ not: { equals: { baz: 'qux' } } });

      const barSubfilter = Array.from(filters.get(id1).subfilters)[0];
      const storage = foPairs.get('notequals');

      should(storage.fields).have.keys('foo', 'baz');

      dsl.remove(id2);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get('bar')).match(new Set([barSubfilter]));
      should(storage.fields.get('baz')).be.undefined();
    });
  });
});
