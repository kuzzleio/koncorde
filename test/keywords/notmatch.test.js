const should = require('should/as-function');
const FieldOperand = require('../../lib/engine/objects/fieldOperand');
const { Koncorde } = require('../../');

describe('Koncorde.keyword.notmatch', () => {
  let koncorde;
  let engine;

  beforeEach(() => {
    koncorde = new Koncorde();
    engine = koncorde.engines.get(null);
  });

  function getSubfilter(id) {
    return Array.from(engine.filters.get(id).subfilters)[0];
  }

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      const result = koncorde.transformer.standardizer.standardize({
        not: {
          match: {
            foo: 'bar',
          },
        },
      });

      should(result).match({not: {match: {foo: 'bar'}}});
    });
  });

  describe('#matching', () => {
    it('should not match a document with the subscribed keyword', () => {
      koncorde.register({ not: { match: { foo: 'bar' } } });

      should(koncorde.test({ foo: 'bar' })).be.an.Array().and.be.empty();
    });

    it('should match if the document contains the field with another value', () => {
      const id = koncorde.register({ not: { match: { foo: 'bar' } } });

      const result = koncorde.test({ foo: 'qux' });

      should(result).eql([id]);
    });

    it('should match if the document do not contain the registered field', () => {
      const id = koncorde.register({ not: { match: { foo: 'bar' } } });

      const result = koncorde.test({ qux: 'bar' });

      should(result).eql([id]);
    });

    it('should match if the document array does not contain all the registered value', () => {
      const id = koncorde.register({ not: { match: { foo: ['bar', 'baz'] } } });

      const result = koncorde.test({ foo: ['bar'] });

      should(result).eql([id]);
    });

    it('should match if the document array does not contain all the registered value', () => {
      const id = koncorde.register({ not: { match: { foo: [ { a: 'bar' }, { a: 'baz' }] } } });

      const result = koncorde.test({ foo: [{ a: 'bar' }, { a: 'qux' }] });

      should(result).eql([id]);
    });

    it('should match a document with the subscribed nested keyword', () => {
      const id = koncorde.register({
        not: {
          match: {
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
      koncorde.register({ not: { match: { a: 'Jennifer Cardini' } } });
      koncorde.register({ not: { match: { b: 'Shonky' } } });

      should(koncorde.test({ a: 'Jennifer Cardini' })).be.an.Array().length(1);
    });

    it('should match 0 equality', () => {
      koncorde.register({ not: { match: { a: 0 } } });

      should(koncorde.test({ a: 0 })).be.an.Array().be.empty();
    });

    it('should match false equality', () => {
      koncorde.register({ not: { match: { a: false } } });

      should(koncorde.test({ a: false })).be.an.Array().be.empty();
    });

    it('should match null equality', () => {
      koncorde.register({ not: { match: { a: null } } });

      should(koncorde.test({ a: null })).be.an.Array().be.empty();
    });

    it('should match undefined equality', () => {
      koncorde.register({ not: { match: { a: undefined } } });

      should(koncorde.test({ a: undefined })).be.an.Array().be.empty();
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const id = koncorde.register({ not: { match: { foo: 'bar' } } });

      koncorde.remove(id);

      should(engine.foPairs).be.an.Object().and.be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const id1 = koncorde.register({ not: { match: { foo: 'bar' } } });
      const id2 = koncorde.register({
        and: [
          { not: { match: { foo: 'qux' } } },
          { not: { match: { foo: 'bar' } } },
        ],
      });

      koncorde.remove(id1);

      const match = engine.foPairs.get('notmatch');
      const multiSubfilter = getSubfilter(id2);

      should(match).be.an.instanceof(FieldOperand);
      should(match.custom.filters.findIndex(f => f.subfilter.id === multiSubfilter.id && f.value.foo === 'qux')).be.greaterThan(-1);
      should(match.custom.filters.findIndex(f => f.subfilter.id === multiSubfilter.id && f.value.foo === 'bar')).be.greaterThan(-1);
    });
  });
});
