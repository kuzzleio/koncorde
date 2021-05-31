const should = require('should/as-function');
const sinon = require('sinon');
const Koncorde = require('../../');

describe('Koncorde.keyword.missing', () => {
  let koncorde;

  beforeEach(() => {
    koncorde = new Koncorde();
  });

  describe('#standardization', () => {
    it('should return a parsed "not exists" condition (from old syntax)', () => {
      const spy = sinon.spy(koncorde.transformer.standardizer, 'exists');

      const result = koncorde.transformer.standardizer.standardize({missing: {field: 'foo'}});
      should(spy.called).be.true();
      should(result).match({ not: { exists: {path: 'foo', array: false} } });
    });

    it('should return a parsed "not exists" condition', () => {
      const spy = sinon.spy(koncorde.transformer.standardizer, 'exists');

      const result = koncorde.transformer.standardizer.standardize({missing: 'foo'});
      should(spy.called).be.true();
      should(result).match({ not: { exists: {path: 'foo', array: false} } });
    });
  });

  describe('#matching', () => {
    it('should match a document without the subscribed field', () => {
      const id = koncorde.register({ not: { exists: 'foo' } });

      should(koncorde.test({ bar: 'qux' })).eql([id]);
    });

    it('should not match if the document contain the searched field', () => {
      koncorde.register({ not: { exists: 'foo' } });

      should(koncorde.test({ foo: 'bar' })).be.an.Array().and.empty();
    });

    it('should match if the document contains an explicitly undefined field', () => {
      const id = koncorde.register({ not: { exists: 'foo' } });

      should(koncorde.test({ foo: undefined })).eql([id]);
    });

    it('should match a document with the subscribed nested keyword', () => {
      koncorde.register({ not: { exists: 'foo.bar.baz' } });
      should(koncorde.test({ foo: { bar: { baz: 'qux' } } }))
        .be.an.Array().and.empty();
    });

    it('should match if a document has the searched field, but not the searched array value', () => {
      const id = koncorde.register({ not: { exists: 'foo.bar["baz"]' } });
      should(koncorde.test({ foo: { bar: [ 'qux' ] } })).eql([id]);
    });

    it('should not match if a document has the searched field, and the searched array value', () => {
      koncorde.register({ not: { exists: 'foo.bar["baz"]' } });
      should(koncorde.test({ foo: { bar: [ 'baz' ] } })).Array().empty();
    });

    it('should match if a field is entirely missing, while looking for an array value only', () => {
      const id = koncorde.register({ missing: 'foo.bar["baz"' });
      should(koncorde.test({ bar: 'foo' })).eql([id]);
    });

    it('should match if looking for an array value, and the field is not an array', () => {
      const id = koncorde.register({ missing: 'foo.bar["baz"]' });
      should(koncorde.test({ foo: { bar: 42 } })).eql([id]);
    });

    it('should match if there is a type mismatch', () => {
      const id = koncorde.register({ not: { exists: 'foo.bar["true"]' } });
      should(koncorde.test({ foo: { bar: [ true ] } })).eql([id]);
    });
  });
});
