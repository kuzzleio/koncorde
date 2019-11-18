'use strict';

const
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  FieldOperand = require('../../lib/storage/objects/fieldOperand'),
  DSL = require('../../');

describe('DSL.keyword.equals', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  function getSubfilter(id) {
    return Array.from(dsl.storage.filters.get(id).subfilters)[0];
  }

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(dsl.validate({equals: ['foo', 'bar']})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with more than 1 field', () => {
      return should(dsl.validate({equals: {foo: 'foo', bar: 'bar'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with array argument', () => {
      return should(dsl.validate({equals: {foo: ['bar']}})).be.rejectedWith(BadRequestError);
    });

    it('should validate filters with number argument', () => {
      return should(dsl.validate({equals: {foo: 42}})).be.fulfilledWith(true);
    });

    it('should reject filters with object argument', () => {
      return should(dsl.validate({equals: {foo: {}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with undefined argument', () => {
      return should(dsl.validate({equals: {foo: undefined}})).be.rejectedWith(BadRequestError);
    });

    it('should validate filters with null argument', () => {
      return should(dsl.validate({equals: {foo: null}})).be.fulfilledWith(true);
    });

    it('should validate filters with boolean argument', () => {
      return should(dsl.validate({equals: {foo: true}})).be.fulfilledWith(true);
    });

    it('should validate filters with a string argument', () => {
      return should(dsl.validate({equals: {foo: 'bar'}})).be.fulfilledWith(true);
    });

    it('should validate filters with an empty string argument', () => {
      return should(dsl.validate({equals: {foo: ''}})).be.fulfilledWith(true);
    });
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      return should(dsl.transformer.standardizer.standardize({equals: {foo: 'bar'}})).be.fulfilledWith({equals: {foo: 'bar'}});
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => {
          const
            subfilter = getSubfilter(subscription.id),
            storage = dsl.storage.foPairs.get('index', 'collection', 'equals');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo'))
            .instanceOf(Map)
            .have.value('bar', new Set([subfilter]));
        });
    });

    it('should store multiple conditions on the same field correctly', () => {
      let barSubfilter;

      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => {
          barSubfilter = getSubfilter(subscription.id);

          return dsl.register('index', 'collection', {equals: {foo: 'qux'}});
        })
        .then(subscription => {
          const quxSubfilter = getSubfilter(subscription.id);
          const equals = dsl.storage.foPairs.get(
            'index',
            'collection',
            'equals');

          should(equals).be.an.instanceof(FieldOperand);
          should(equals.fields.get('foo'))
            .have.value('bar', new Set([barSubfilter]));
          should(equals.fields.get('foo'))
            .have.value('qux', new Set([quxSubfilter]));
        });
    });

    it('should store multiple subfilters on the same condition correctly', () => {
      let barSubfilter;

      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => {
          barSubfilter = getSubfilter(subscription.id);

          return dsl.register('index', 'collection', {
            and: [
              { equals: { baz: 'qux' } },
              { equals: { foo: 'bar' } }
            ]
          });
        })
        .then(subscription => {
          const multiSubfilter = getSubfilter(subscription.id);
          const equals = dsl.storage.foPairs.get('index', 'collection', 'equals');

          should(equals).be.an.instanceof(FieldOperand);
          should(equals.fields.get('foo'))
            .have.value('bar', new Set([barSubfilter, multiSubfilter]));
          should(equals.fields.get('baz'))
            .have.value('qux', new Set([multiSubfilter]));
        });
    });
  });

  describe('#matching', () => {
    it('should match a document with the subscribed keyword', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => {
          const result = dsl.test('index', 'collection', {foo: 'bar'});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should match a document on its provided id', () => {
      return dsl.register('index', 'collection', {equals: {_id: 'foo'}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: 'bar'}, 'foo');

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if the document contains the field with another value', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should not match if the document contains another field with the registered value', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(() => {
          should(dsl.test('index', 'collection', {qux: 'bar'})).be.an.Array().and.empty();
        });
    });

    // see https://github.com/kuzzleio/koncorde/issues/13
    it('should skip the matching if the document tested property is not of the same type than the known values', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: ['bar']})).be.an.Array().and.empty();
          should(dsl.test('index', 'collection', {foo: {bar: true}})).be.an.Array().and.empty();
        });
    });

    it('should match a document with the subscribed nested keyword', () => {
      return dsl.register('index', 'collection', {equals: {'foo.bar.baz': 'qux'}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: {bar: {baz: 'qux'}}});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if the document is in another index', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(() => {
          should(dsl.test('foobar', 'collection', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should not match if the document is in another collection', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(() => {
          should(dsl.test('index', 'foobar', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should match 0 equality', () => {
      return dsl.register('i', 'c', {equals: {a: 0}})
        .then(() => {
          should(dsl.test('i', 'c', {a: 0}))
            .be.an.Array()
            .length(1);
        });
    });

    it('should match false equality', () => {
      return dsl.register('i', 'c', {equals: {a: false}})
        .then(() => {
          should(dsl.test('i', 'c', {a: false}))
            .be.an.Array()
            .length(1);
        });
    });

    it('should match null equality', () => {
      return dsl.register('i', 'c', {equals: {a: null}})
        .then(() => {
          should(dsl.test('i', 'c', {a: null}))
            .be.an.Array()
            .length(1);
        });
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(dsl.storage.foPairs._cache).be.an.Object().and.be.empty();
        });
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      let
        idToRemove,
        multiSubfilter;

      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => {
          idToRemove = subscription.id;

          return dsl.register('index', 'collection', {
            and: [
              {equals: {baz: 'qux'}},
              {equals: {foo: 'bar'}}
            ]
          });
        })
        .then(subscription => {
          multiSubfilter = getSubfilter(subscription.id);

          return dsl.remove(idToRemove);
        })
        .then(() => {
          const equals = dsl.storage.foPairs
            .get('index', 'collection', 'equals');

          should(equals).be.an.instanceof(FieldOperand);
          should(equals.fields.get('foo'))
            .have.value('bar', new Set([multiSubfilter]));
          should(equals.fields.get('baz'))
            .have.value('qux', new Set([multiSubfilter]));
        });
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      let
        equals,
        barSubfilter;

      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => {
          equals = dsl.storage.foPairs.get('index', 'collection', 'equals');

          barSubfilter = getSubfilter(subscription.id);

          return dsl.register('index', 'collection', {equals: {foo: 'qux'}});
        })
        .then(subscription => {
          should(equals.fields.get('foo').get('bar')).eql(new Set([barSubfilter]));
          should(equals.fields.get('foo').get('qux')).eql(new Set([getSubfilter(subscription.id)]));
          return dsl.remove(subscription.id);
        })
        .then(() => {
          should(equals).be.an.instanceof(FieldOperand);
          should(equals.fields.get('foo'))
            .have.value('bar', new Set([barSubfilter]))
            .not.have.key('qux');
        });
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      let
        barSubfilter,
        equals;

      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => {
          barSubfilter = getSubfilter(subscription.id);

          return dsl.register('index', 'collection', {equals: {baz: 'qux'}});
        })
        .then(subscription => {
          equals = dsl.storage.foPairs.get('index', 'collection', 'equals');

          should(equals.fields.get('baz'))
            .have.value('qux', new Set([getSubfilter(subscription.id)]));

          return dsl.remove(subscription.id);
        })
        .then(() => {
          should(equals).be.an.instanceof(FieldOperand);
          should(equals.fields.get('foo'))
            .have.value('bar', new Set([barSubfilter]));
          should(equals.fields).not.have.key('baz');
        });
    });

    it('should remove a single collection if other collections are registered', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(() => dsl.register('index', 'collection2', {equals: {foo: 'bar'}}))
        .then(subscription => {
          should(dsl.storage.foPairs.has('index', 'collection')).be.true();
          should(dsl.storage.foPairs.has('index', 'collection2')).be.true();
          return dsl.remove(subscription.id);
        })
        .then(() => {
          should(dsl.storage.foPairs.has('index', 'collection')).be.true();
          should(dsl.storage.foPairs.has('index', 'collection2')).be.false();
        });
    });
  });
});
