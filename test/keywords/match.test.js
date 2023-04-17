const should = require('should/as-function');

const FieldOperand = require('../../lib/engine/objects/fieldOperand');
const { Koncorde } = require('../../lib');

describe('Koncorde.keyword.match', () => {
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
    it('should reject non-object filters', () => {
      should(() => koncorde.validate({ match: ['foo', 'bar'] }))
        .throw({
          keyword: 'match',
          message: '"match": must be an object',
          path: 'match',
        });
    });

    it('should reject empty filters', () => {
      should(() => koncorde.validate({ match: {} }))
        .throw({
          keyword: 'match',
          message: '"match": must be a non-empty object',
          path: 'match',
        });
    });


    it('should validate filters with number argument', () => {
      should(() => koncorde.validate({ match: { foo: 42 } })).not.throw();
    });

    it('should validate filters with array argument', () => {
      should(() => koncorde.validate({ match: { foo: [42] } })).not.throw();
    });

    it('should validate filters with object argument', () => {
      should(() => koncorde.validate({ match: { foo: {} } })).not.throw();
    });

    it('should validate filters with object argument', () => {
      should(() => koncorde.validate({ match: { foo: undefined } })).not.throw();
    });

    it('should validate filters with null argument', () => {
      should(() => koncorde.validate({ match: { foo: null } })).not.throw();
    });

    it('should validate filters with boolean argument', () => {
      should(() => koncorde.validate({ match: { foo: true } })).not.throw();
    });

    it('should validate filters with a string argument', () => {
      should(() => koncorde.validate({ match: { foo: 'bar' } })).not.throw();
    });

    it('should validate filters with an empty string argument', () => {
      should(() => koncorde.validate({ match: { foo: '' } })).not.throw();
    });
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      should(koncorde.transformer.standardizer.standardize({ match: { foo: 'bar' } }))
        .match({ match: { foo: 'bar' } });
    });
  });

  describe('#matching', () => {
    it('should match a document if partially equal', () => {
      const id = koncorde.register({ match: { foo: 'bar' } });
      const result = koncorde.test({ foo: 'bar', 'bar': 'baz' });

      should(result).be.an.Array().and.not.empty();
      should(result[0]).be.eql(id);
    });

    it('should match a document if the array contains all the element of the filter', () => {
      const id = koncorde.register({ match: { foo: [4, 2] } });
      const result = koncorde.test({ foo: [1, 4, 9, 2] });

      should(result).be.an.Array().and.not.empty();
      should(result[0]).be.eql(id);
    });

    it('should match a document if the array contains all the element of the filter and sub arrays and objects matches', () => {
      const id = koncorde.register({ match: { foo: [ { a: 1 } ] } });
      const result = koncorde.test({ foo: [ { b: 1 }, { a: 1, b: 2 }] });

      should(result).be.an.Array().and.not.empty();
      should(result[0]).be.eql(id);
    });

    it('should not match if the document contains the field with another value', () => {
      koncorde.register({ match: { foo: 'bar' } });

      should(koncorde.test({ foo: 'qux' })).be.an.Array().and.be.empty();
    });

    it('should not match if the document contains another field with the registered value', () => {
      koncorde.register({ match: { foo: 'bar' } });
      should(koncorde.test({ qux: 'bar' })).be.an.Array().and.be.empty();
    });

    // see https://github.com/kuzzleio/koncorde/issues/13
    it('should skip the matching if the document tested property is not of the same type than the known values', () => {
      koncorde.register({ match: { foo: 'bar' } });

      should(koncorde.test({ foo: ['bar'] })).be.an.Array().and.empty();

      should(koncorde.test({ foo: { bar: true } })).be.an.Array().and.empty();
    });

    it('should match a document with the subscribed nested keyword', () => {
      const id = koncorde.register({ match: { 'foo.bar.baz': 'qux' } });
      const result = koncorde.test({ foo: { bar: { baz: 'qux' } } });

      should(result).be.an.Array().and.not.empty();
      should(result[0]).be.eql(id);
    });

    it('should match 0 equality', () => {
      koncorde.register({ match: { a: 0 } });
      should(koncorde.test({ a: 0 })).be.an.Array().length(1);
    });

    it('should match false equality', () => {
      koncorde.register({ match: { a: false } });
      should(koncorde.test({ a: false })).be.an.Array().length(1);
    });

    it('should match null equality', () => {
      koncorde.register({ match: { a: null } });
      should(koncorde.test({ a: null })).be.an.Array().length(1);
    });

    it('should match undefined equality', () => {
      koncorde.register({ match: { a: undefined } });
      should(koncorde.test({ a: undefined })).be.an.Array().length(1);
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const id = koncorde.register({ match: { foo: 'bar' } });

      koncorde.remove(id);

      should(engine.foPairs).be.an.Object().and.be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const id1 = koncorde.register({ match: { foo: 'bar' } });
      const id2 = koncorde.register({
        and: [
          { match: { baz: 'qux' } },
          { match: { foo: 'bar' } },
        ],
      });

      koncorde.remove(id1);

      const match = engine.foPairs.get('match');
      const multiSubfilter = getSubfilter(id2);

      should(match).be.an.instanceof(FieldOperand);
      should(match.custom.filters.findIndex(f => f.subfilter.id === multiSubfilter.id && f.value.baz === 'qux')).be.greaterThan(-1);
      should(match.custom.filters.findIndex(f => f.subfilter.id === multiSubfilter.id && f.value.foo === 'bar')).be.greaterThan(-1);
    });
  });
});
