const should = require('should/as-function');
const sinon = require('sinon');
const DSL = require('../../');

describe('DSL.keyword.missing', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#standardization', () => {
    it('should return a parsed "not exists" condition (from old syntax)', () => {
      const spy = sinon.spy(dsl.transformer.standardizer, 'exists');

      const result = dsl.transformer.standardizer.standardize({missing: {field: 'foo'}});
      should(spy.called).be.true();
      should(result).match({ not: { exists: {path: 'foo', array: false} } });
    });

    it('should return a parsed "not exists" condition', () => {
      const spy = sinon.spy(dsl.transformer.standardizer, 'exists');

      const result = dsl.transformer.standardizer.standardize({missing: 'foo'});
      should(spy.called).be.true();
      should(result).match({ not: { exists: {path: 'foo', array: false} } });
    });
  });

  describe('#matching', () => {
    it('should match a document without the subscribed field', () => {
      const sub = dsl.register('index', 'collection', {not: {exists: 'foo'}});

      should(dsl.test('index', 'collection', {bar: 'qux'})).eql([sub.id]);
    });

    it('should not match if the document contain the searched field', () => {
      dsl.register('index', 'collection', {not: {exists: 'foo'}});
      should(dsl.test('index', 'collection', {foo: 'bar'}))
        .be.an.Array().and.empty();
    });

    it('should match if the document contains an explicitly undefined field', () => {
      const sub = dsl.register('index', 'collection', {not: {exists: 'foo'}});

      should(dsl.test('index', 'collection', {foo: undefined})).eql([sub.id]);
    });

    it('should match a document with the subscribed nested keyword', () => {
      dsl.register('index', 'collection', {not: {exists: 'foo.bar.baz'}});
      should(dsl.test('index', 'collection', {foo: {bar: {baz: 'qux'}}}))
        .be.an.Array().and.empty();
    });

    it('should match if a document has the searched field, but not the searched array value', () => {
      const sub = dsl.register('i', 'c', {not: {exists: 'foo.bar["baz"]'}});
      should(dsl.test('i', 'c', {foo: {bar: ['qux']}})).eql([sub.id]);
    });

    it('should not match if a document has the searched field, and the searched array value', () => {
      dsl.register('i', 'c', {not: {exists: 'foo.bar["baz"]'}});
      should(dsl.test('i', 'c', {foo: {bar: ['baz']}})).Array().empty();
    });

    it('should match if a field is entirely missing, while looking for an array value only', () => {
      const sub = dsl.register('i', 'c', {missing: 'foo.bar["baz"'});
      should(dsl.test('i', 'c', {bar: 'foo'})).eql([sub.id]);
    });

    it('should match if looking for an array value, and the field is not an array', () => {
      const sub = dsl.register('i', 'c', {missing: 'foo.bar["baz"]'});
      should(dsl.test('i', 'c', {foo: {bar: 42}})).eql([sub.id]);
    });

    it('should match if there is a type mismatch', () => {
      const sub = dsl.register('i', 'c', {not: {exists: 'foo.bar["true"]'}});
      should(dsl.test('i', 'c', {foo: {bar: [true]}})).eql([sub.id]);
    });

    it('should not match if the document is in another index', () => {
      dsl.register('index', 'collection', {not: {exists: 'foo'}});
      should(dsl.test('foobar', 'collection', {'qux': 'qux'}))
        .be.an.Array().and.empty();
    });

    it('should not match if the document is in another collection', () => {
      dsl.register('index', 'collection', {not: {exists: 'foo'}});
      should(dsl.test('index', 'foobar', {'qux': 'qux'}))
        .be.an.Array().and.empty();
    });
  });
});
