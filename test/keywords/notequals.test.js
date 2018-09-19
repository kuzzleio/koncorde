'use strict';

require('reify');

const
  should = require('should'),
  FieldOperand = require('../../lib/storage/objects/fieldOperand'),
  DSL = require('../../');

describe('DSL.keyword.notequals', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      return should(dsl.transformer.standardizer.standardize({not: {equals: {foo: 'bar'}}})).be.fulfilledWith({not: {equals: {foo: 'bar'}}});
    });
  });

  describe('#matching', () => {
    it('should not match a document with the subscribed keyword', () => {
      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: 'bar'})).be.an.Array().and.be.empty();
        });
    });

    it('should match if the document contains the field with another value', () => {
      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => {
          let result = dsl.test('index', 'collection', {foo: 'qux'});
          should(result).be.an.Array().and.not.empty();
          should(result).match([subscription.id]);
        });
    });

    it('should match if the document do not contain the registered field', () => {
      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => {
          let result = dsl.test('index', 'collection', {qux: 'bar'});
          should(result).be.an.Array().and.not.empty();
          should(result).match([subscription.id]);
        });
    });

    it('should match a document with the subscribed nested keyword', () => {
      return dsl.register('index', 'collection', {not: {equals: {'foo.bar.baz': 'qux'}}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: {bar: {baz: 'foobar'}}});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if the document is in another index', () => {
      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(() => {
          should(dsl.test('foobar', 'collection', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should not match if the document is in another collection', () => {
      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(() => {
          should(dsl.test('index', 'foobar', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should match even if another field was hit before', () => {
      return dsl.register('i', 'c', {not: {equals: {a: 'Jennifer Cardini'}}})
        .then(() => dsl.register('i', 'c', {not: {equals: {b: 'Shonky'}}}))
        .then(() => {
          should(dsl.test('i', 'c', {a: 'Jennifer Cardini'}))
            .be.an.Array()
            .length(1);
        });
    });

    it('should match 0 equality', () => {
      return dsl.register('i', 'c', {not: {equals: {a: 0}}})
        .then(() => {
          should(dsl.test('i', 'c', {a: 0}))
            .be.an.Array()
            .be.empty();
        });
    });

    it('should match false equality', () => {
      return dsl.register('i', 'c', {not: {equals: {a: false}}})
        .then(() => {
          should(dsl.test('i', 'c', {a: false}))
            .be.an.Array()
            .be.empty();
        });
    });

    it('should match null equality', () => {
      return dsl.register('i', 'c', {not: {equals: {a: null}}})
        .then(() => {
          should(dsl.test('i', 'c', {a: null}))
            .be.an.Array()
            .be.empty();
        });
    });

  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(dsl.storage.foPairs).be.an.Object().and.be.empty();
        });
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      let
        idToRemove,
        barSubfilter,
        quxSubfilter;

      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => {
          idToRemove = subscription.id;
          return dsl.register('index', 'collection', {and: [{not: {equals: {foo: 'qux'}}}, {not: {equals: {foo: 'bar'}}}]});
        })
        .then(subscription => {
          barSubfilter = dsl.storage.filters[subscription.id].subfilters[0];
          quxSubfilter = dsl.storage.filters[subscription.id].subfilters[0];
          return dsl.remove(idToRemove);
        })
        .then(() => {
          const storage = dsl.storage.foPairs.index.collection.notequals;

          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).match(['foo']);
          should(storage.fields.foo).instanceOf(Map);
          should(storage.fields.foo.size).eql(2);
          should(storage.fields.foo.get('bar')).eql([quxSubfilter]);
          should(storage.fields.foo.get('qux')).eql([quxSubfilter]);
        });
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      let barSubfilter;

      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => {
          barSubfilter = dsl.storage.filters[subscription.id].subfilters[0];

          return dsl.register('index', 'collection', {and: [{not: {equals: {foo: 'qux'}}}, {not: {equals: {foo: 'bar'}}}]});
        })
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          const storage = dsl.storage.foPairs.index.collection.notequals;
          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).match(['foo']);
          should(storage.fields.foo.get('bar')).match([barSubfilter]);
          should(storage.fields.foo.get('qux')).undefined();
        });
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      let barSubfilter;

      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => {
          barSubfilter = dsl.storage.filters[subscription.id].subfilters[0];

          return dsl.register('index', 'collection', {not: {equals: {baz: 'qux'}}});
        })
        .then(subscription => {
          should(dsl.storage.foPairs.index.collection.notequals.keys).match(['baz', 'foo']);
          return dsl.remove(subscription.id);
        })
        .then(() => {
          const storage = dsl.storage.foPairs.index.collection.notequals.keys;
          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).match(['foo']);
          should(storage.fields.foo.get('bar')).match([barSubfilter]);
          should(storage.fields.baz).be.undefined();
        });
    });
  });
});
