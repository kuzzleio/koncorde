'use strict';

const
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  FieldOperand = require('../../lib/storage/objects/fieldOperand'),
  DSL = require('../../'),
  NormalizedExists = require('../../lib/transform/normalizedExists');

describe('DSL.keyword.exists', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(dsl.validate({exists: {}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with more than 1 field', () => {
      return should(dsl.validate({exists: {field: 'foo', bar: 'bar'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with array argument', () => {
      return should(dsl.validate({exists: {field: ['bar']}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with number argument', () => {
      return should(dsl.validate({exists: {field: 42}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with object argument', () => {
      return should(dsl.validate({exists: {field: {}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with undefined argument', () => {
      return should(dsl.validate({exists: {field: undefined}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with null argument', () => {
      return should(dsl.validate({exists: {field: null}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with boolean argument', () => {
      return should(dsl.validate({exists: {field: true}})).be.rejectedWith(BadRequestError);
    });

    it('should validate filters with a string argument', () => {
      return should(dsl.validate({exists: {field: 'bar'}})).be.fulfilledWith(true);
    });

    it('should reject filters with an empty string argument', () => {
      return should(dsl.validate({exists: {field: ''}}))
        .be.rejectedWith(BadRequestError, {message: 'exists: cannot test empty field name'});
    });

    it('should validate filters written in simplified form', () => {
      return should(dsl.validate({exists: 'bar'})).fulfilledWith(true);
    });

    it('should reject a filter in simplified form with an empty value', () => {
      return should(dsl.validate({exists: ''}))
        .rejectedWith(BadRequestError, {message: 'exists: cannot test empty field name'});
    });

    it('should reject incorrectly formatted array search filters', () => {
      return should(dsl.validate({exists: 'foo[\'bar\']'}))
        .rejectedWith(BadRequestError, {message: '[exists] Invalid array value "\'bar\'"'});
    });
  });

  describe('#standardization', () => {
    it('should return the normalized filter (from old syntax)', () => {
      return should(dsl.transformer.standardizer.standardize({exists: {field: 'bar'}}))
        .be.fulfilledWith({exists: new NormalizedExists('bar', false, null)});
    });

    it('should return the normalized filter (from simplified syntax)', () => {
      return should(dsl.transformer.standardizer.standardize({exists: 'bar'}))
        .be.fulfilledWith({exists: new NormalizedExists('bar', false, null)});
    });

    it('should parse and normalize array values', () => {
      const values = [42, 3.14, true, false, null, '"foobar"', '"null"', '"true"', '"42"'];

      const promises = values.map(v => dsl.transformer.standardizer.standardize({exists: `foo.bar[${v}]`}));

      return Promise.all(promises)
        .then(results => {
          for (let i = 0; i < values.length; i++) {
            const expected = typeof values[i] === 'string' ? values[i].replace(/"/g, '') : values[i];
            should(results[i].exists).instanceOf(NormalizedExists);
            should(results[i].exists.array).be.true();
            should(results[i].exists.path).eql('foo.bar');
            should(results[i].exists.value).eql(expected);
            should(typeof results[i].exists.value).eql(typeof values[i]);
          }
        });
    });

    it('should not interpret unclosed brackets as an array value', () => {
      return should(dsl.transformer.standardizer.standardize({exists: 'foo[bar'}))
        .be.fulfilledWith({exists: new NormalizedExists('foo[bar', false, null)});
    });

    it('should properly interpret escaped brackets as an object field name', () => {
      return should(dsl.transformer.standardizer.standardize({exists: 'foo.ba\\[true\\]'}))
        .be.fulfilledWith({exists: new NormalizedExists('foo.ba[true]', false, null)});
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      return dsl.register('index', 'collection', {exists: 'foo'})
        .then(subscription => {
          const
            subfilter = dsl.storage.filters.get(subscription.id).subfilters,
            storage = dsl.storage.foPairs.index.collection.get('exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo']));
          should(storage.fields.foo.subfilters).eql(subfilter);
          should(storage.fields.foo.values).instanceOf(Map);
          should(storage.fields.foo.values.size).eql(0);
        });
    });

    it('should store multiple subfilters on the same condition correctly', () => {
      let barSubfilter;

      return dsl.register('index', 'collection', {exists: 'foo'})
        .then(subscription => {
          barSubfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];

          return dsl.register('index', 'collection', {
            and: [
              {equals: {bar: 'qux'}},
              {exists: 'foo'}
            ]
          });
        })
        .then(subscription => {
          const
            quxSubfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            storage = dsl.storage.foPairs.index.collection.get('exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo']));
          should(storage.fields.foo.subfilters).eql(new Set([barSubfilter, quxSubfilter]));
          should(storage.fields.foo.values).instanceOf(Map);
          should(storage.fields.foo.values.size).eql(0);
        });
    });

    it('should store a single array search correctly', () => {
      return dsl.register('index', 'collection', {exists: 'foo["bar"]'})
        .then(subscription => {
          const
            subfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            storage = dsl.storage.foPairs.index.collection.get('exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo']));
          should(storage.fields.foo.subfilters.size).eql(0);
          should(storage.fields.foo.values).instanceOf(Map);
          should(storage.fields.foo.values.size).eql(1);
          should(storage.fields.foo.values.get('bar')).eql(new Set([subfilter]));
        });
    });

    it('should multiple array searches correctly', () => {
      let barSubfilter;

      return dsl.register('index', 'collection', {exists: 'foo["bar"]'})
        .then(subscription => {
          barSubfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];

          return dsl.register('index', 'collection', {
            and: [
              {exists: 'qux["bar"]'},
              {exists: 'foo["bar"]'}
            ]
          });
        })
        .then(subscription => {
          const
            quxSubfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            storage = dsl.storage.foPairs.index.collection.get('exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo', 'qux']));
          should(storage.fields.foo.subfilters.size).eql(0);
          should(storage.fields.foo.values).instanceOf(Map);
          should(storage.fields.foo.values.size).eql(1);
          should(storage.fields.foo.values.get('bar')).eql(new Set([barSubfilter, quxSubfilter]));
          should(storage.fields.qux.values.get('bar')).eql(new Set([quxSubfilter]));
        });
    });
  });

  describe('#matching', () => {
    it('should match a document with the subscribed field', () => {
      return dsl.register('index', 'collection', {exists: 'foo'})
        .then(subscription => {
          const result = dsl.test('index', 'collection', {foo: 'bar'});

          should(result).eql([subscription.id]);
        });
    });

    it('should not match if the document does not contain the searched field', () => {
      return dsl.register('index', 'collection', {exists: 'foo'})
        .then(() => {
          should(dsl.test('index', 'collection', {fooo: 'baz'})).be.an.Array().and.empty();
        });
    });

    it('should match a document with the subscribed nested keyword', () => {
      return dsl.register('index', 'collection', {exists: 'foo.bar.baz'})
        .then(subscription => {
          const result = dsl.test('index', 'collection', {foo: {bar: {baz: 'qux'}}});

          should(result).eql([subscription.id]);
        });
    });

    it('should not match if the document is in another index', () => {
      return dsl.register('index', 'collection', {exists: 'foo'})
        .then(() => {
          should(dsl.test('foobar', 'collection', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should not match if the document is in another collection', () => {
      return dsl.register('index', 'collection', {exists: 'foo'})
        .then(() => {
          should(dsl.test('index', 'foobar', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should match if a searched value is in the document', () => {
      const
        values = ['"foo"', '"bar"', 3.14, 42, false, true, null],
        promises = values.map(v => dsl.register('i', 'c', {exists: `foo[${v}]`}));

      return Promise.all(promises)
        .then(subscriptions => {
          for (let i = 0; i < subscriptions.length; i++) {
            const expected = typeof values[i] === 'string' ? values[i].replace(/"/g, '') : values[i];

            should(dsl.test('i', 'c', {foo: ['hello', expected, 'world']}))
              .eql([subscriptions[i].id]);
          }
        });
    });

    it('should not match if an array search is not of the right type', () => {
      return dsl.register('i', 'c', {exists: 'foo[null]'})
        .then(subscription => {
          should(dsl.test('i', 'c', {foo: [null]})).eql([subscription.id]);
          should(dsl.test('i', 'c', {foo: ['null']})).empty();
        });
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      return dsl.register('index', 'collection', {exists: 'foo'})
        .then(subscription => dsl.remove(subscription.id))
        .then(() => should(dsl.storage.foPairs).be.an.Object().and.be.empty());
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      let
        idToRemove,
        multiSubfilter;

      return dsl.register('index', 'collection', {exists: 'foo'})
        .then(subscription => {
          idToRemove = subscription.id;

          return dsl.register('index', 'collection', {
            and: [
              {equals: {foo: 'qux'}},
              {exists: {field: 'foo'}}
            ]
          });
        })
        .then(subscription => {
          multiSubfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];

          return dsl.remove(idToRemove);
        })
        .then(() => {
          const storage = dsl.storage.foPairs.index.collection.get('exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo']));
          should(storage.fields.foo.subfilters).match(new Set([multiSubfilter]));
          should(storage.fields.foo.values).be.instanceOf(Map);
          should(storage.fields.foo.values.size).eql(0);
        });
    });

    it('should remove a single subfilter from a multi-filter array condition', () => {
      let
        storage,
        idToRemove,
        singleSubfilter,
        multiSubfilter;

      return dsl.register('index', 'collection', {exists: 'foo["bar"]'})
        .then(subscription => {
          idToRemove = subscription.id;
          storage = dsl.storage.foPairs.index.collection.get('exists');
          singleSubfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];

          return dsl.register('index', 'collection', {
            and: [
              {equals: {foo: 'qux'}},
              {exists: {field: 'foo["bar"]'}}
            ]
          });
        })
        .then(subscription => {
          multiSubfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];
          should(storage.fields.foo.values.get('bar')).match(new Set([singleSubfilter, multiSubfilter]));
          should(storage.fields.foo.subfilters.size).eql(0);
          return dsl.remove(idToRemove);
        })
        .then(() => {
          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo']));
          should(storage.fields.foo.subfilters.size).eql(0);
          should(storage.fields.foo.values.get('bar')).match(new Set([multiSubfilter]));
        });
    });

    it('should remove a field from the list if its last subfilter is removed', () => {
      let
        fooSubfilter;

      return dsl.register('index', 'collection', {exists: 'foo'})
        .then(subscription => {
          fooSubfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];

          return dsl.register('index', 'collection', {exists: 'bar'});
        })
        .then(subscription => {
          should(dsl.storage.foPairs.index.collection.get('exists').keys).eql(new Set(['foo', 'bar']));
          return dsl.remove(subscription.id);
        })
        .then(() => {
          const storage = dsl.storage.foPairs.index.collection.get('exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo']));
          should(storage.fields.foo.subfilters).match(new Set([fooSubfilter]));
          should(storage.fields.foo.values).be.instanceOf(Map);
          should(storage.fields.foo.values.size).eql(0);
          should(storage.fields.bar).be.undefined();
        });
    });

    it('should remove a field from the list if its last array search value is removed', () => {
      let
        fooSubfilter;

      return dsl.register('index', 'collection', {exists: 'foo'})
        .then(subscription => {
          fooSubfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];

          return dsl.register('index', 'collection', {exists: 'bar["foo"]'});
        })
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          const storage = dsl.storage.foPairs.index.collection.get('exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo']));
          should(storage.fields.foo.subfilters).match(new Set([fooSubfilter]));
          should(storage.fields.foo.values).be.instanceOf(Map);
          should(storage.fields.foo.values.size).eql(0);
          should(storage.fields.bar).be.undefined();
        });
    });

    it('should keep a field if a field existence test remains', () => {
      let
        fooSubfilter;

      return dsl.register('index', 'collection', {exists: 'foo'})
        .then(subscription => {
          fooSubfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];

          return dsl.register('index', 'collection', {exists: 'foo["bar"]'});
        })
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          const storage = dsl.storage.foPairs.index.collection.get('exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo']));
          should(storage.fields.foo.subfilters).match(new Set([fooSubfilter]));
          should(storage.fields.foo.values).be.instanceOf(Map);
          should(storage.fields.foo.values.size).eql(0);
        });
    });

    it('should keep a field if an array search test remains', () => {
      let
        fooSubfilter;

      return dsl.register('index', 'collection', {exists: 'foo["bar"]'})
        .then(subscription => {
          fooSubfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];

          return dsl.register('index', 'collection', {exists: 'foo'});
        })
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          const storage = dsl.storage.foPairs.index.collection.get('exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo']));
          should(storage.fields.foo.subfilters.size).eql(0);
          should(storage.fields.foo.values).be.instanceOf(Map);
          should(storage.fields.foo.values.size).eql(1);
          should(storage.fields.foo.values.get('bar')).eql(new Set([fooSubfilter]));
        });
    });
  });
});
