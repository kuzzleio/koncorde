'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  DSL = require('../../');

describe('DSL.keyword.missing', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#standardization', () => {
    it('should return a parsed "not exists" condition (from old syntax)', () => {
      const spy = sinon.spy(dsl.transformer.standardizer, 'exists');

      return dsl.transformer.standardizer.standardize({missing: {field: 'foo'}})
        .then(result => {
          should(spy.called).be.true();
          should(result).match({ not: { exists: {path: 'foo', array: false} } });
        });
    });

    it('should return a parsed "not exists" condition', () => {
      const spy = sinon.spy(dsl.transformer.standardizer, 'exists');

      return dsl.transformer.standardizer.standardize({missing: 'foo'})
        .then(result => {
          should(spy.called).be.true();
          should(result).match({ not: { exists: {path: 'foo', array: false} } });
        });
    });
  });

  describe('#matching', () => {
    it('should match a document without the subscribed field', () => {
      return dsl.register('index', 'collection', {not: {exists: 'foo'}})
        .then(subscription => {
          ['bar', 'fo', 'fooo', 'qux'].forEach(field => {
            const result = dsl.test('index', 'collection', {[field]: field});

            should(result).eql([subscription.id]);
          });
        });
    });

    it('should not match if the document contain the searched field', () => {
      return dsl.register('index', 'collection', {not: {exists: 'foo'}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: 'bar'})).be.an.Array().and.empty();
        });
    });

    it('should not match if the document contains an explicitly undefined field', () => {
      return dsl.register('index', 'collection', {not: {exists: 'foo'}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: undefined})).be.an.Array().and.empty();
        });
    });

    it('should match a document with the subscribed nested keyword', () => {
      return dsl.register('index', 'collection', {not: {exists: 'foo.bar.baz'}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: {bar: {baz: 'qux'}}})).be.an.Array().and.empty();
        });
    });

    it('should match if a document has the searched field, but not the searched array value', () => {
      return dsl.register('i', 'c', {not: {exists: 'foo.bar["baz"]'}})
        .then(subscription => {
          should(dsl.test('i', 'c', {foo: {bar: ['qux']}})).eql([subscription.id]);
        });
    });

    it('should not match if a document has the searched field, and the searched array value', () => {
      return dsl.register('i', 'c', {not: {exists: 'foo.bar["baz"]'}})
        .then(() => {
          should(dsl.test('i', 'c', {foo: {bar: ['baz']}})).Array().empty();
        });
    });

    it('should match if there is a type mismatch', () => {
      return dsl.register('i', 'c', {not: {exists: 'foo.bar["true"]'}})
        .then(() => {
          should(dsl.test('i', 'c', {foo: {bar: [true]}})).Array().empty();
        });
    });

    it('should not match if the document is in another index', () => {
      return dsl.register('index', 'collection', {not: {exists: 'foo'}})
        .then(() => {
          should(dsl.test('foobar', 'collection', {'qux': 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should not match if the document is in another collection', () => {
      return dsl.register('index', 'collection', {not: {exists: 'foo'}})
        .then(() => {
          should(dsl.test('index', 'foobar', {'qux': 'qux'})).be.an.Array().and.empty();
        });
    });
  });
});
