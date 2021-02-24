const should = require('should/as-function');
const { BadRequestError } = require('kuzzle-common-objects');

const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const Koncorde = require('../../');
const NormalizedExists = require('../../lib/transform/normalizedExists');

describe('Koncorde.keyword.exists', () => {
  let koncorde;

  beforeEach(() => {
    koncorde = new Koncorde();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(koncorde.validate({exists: {}}))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject filters with more than 1 field', () => {
      return should(koncorde.validate({exists: {field: 'foo', bar: 'bar'}}))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject filters with array argument', () => {
      return should(koncorde.validate({exists: {field: ['bar']}}))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject filters with number argument', () => {
      return should(koncorde.validate({exists: {field: 42}}))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject filters with object argument', () => {
      return should(koncorde.validate({exists: {field: {}}}))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject filters with undefined argument', () => {
      return should(koncorde.validate({exists: {field: undefined}}))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject filters with null argument', () => {
      return should(koncorde.validate({exists: {field: null}}))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject filters with boolean argument', () => {
      return should(koncorde.validate({exists: {field: true}}))
        .be.rejectedWith(BadRequestError);
    });

    it('should validate filters with a string argument', () => {
      return should(koncorde.validate({exists: {field: 'bar'}}))
        .be.fulfilledWith();
    });

    it('should reject filters with an empty string argument', () => {
      return should(koncorde.validate({exists: {field: ''}})).be.rejectedWith(
        BadRequestError, {message: 'exists: cannot test empty field name'});
    });

    it('should validate filters written in simplified form', () => {
      return should(koncorde.validate({exists: 'bar'})).fulfilledWith();
    });

    it('should reject a filter in simplified form with an empty value', () => {
      return should(koncorde.validate({exists: ''})).rejectedWith(
        BadRequestError, {message: 'exists: cannot test empty field name'});
    });

    it('should reject incorrectly formatted array search filters', () => {
      return should(koncorde.validate({exists: 'foo[\'bar\']'})).rejectedWith(
        BadRequestError, {message: '[exists] Invalid array value "\'bar\'"'});
    });
  });

  describe('#standardization', () => {
    it('should return the normalized filter (from old syntax)', () => {
      const result = koncorde.transformer.standardizer.standardize({
        exists: { field: 'bar' },
      });

      should(result).match({exists: new NormalizedExists('bar', false, null)});
    });

    it('should return the normalized filter (from simplified syntax)', () => {
      const result = koncorde.transformer.standardizer.standardize({
        exists: 'bar',
      });
      should(result).match({exists: new NormalizedExists('bar', false, null)});
    });

    it('should parse and normalize array values', () => {
      const values = [
        42,
        3.14,
        true,
        false,
        null,
        '"foobar"',
        '"null"',
        '"true"',
        '"42"'
      ];

      for (const value of values) {
        const result = koncorde.transformer.standardizer.standardize({
          exists: `foo.bar[${value}]`,
        });

        const expected = typeof value === 'string' ?
          value.replace(/"/g, '') :
          value;

        should(result.exists).instanceOf(NormalizedExists);
        should(result.exists.array).be.true();
        should(result.exists.path).eql('foo.bar');
        should(result.exists.value).eql(expected);
        should(typeof result.exists.value).eql(typeof value);
      }
    });

    it('should not interpret unclosed brackets as an array value', () => {
      const res = koncorde.transformer.standardizer.standardize({
        exists: 'foo[bar'
      });

      should(res).match({
        exists: new NormalizedExists('foo[bar', false, null)
      });
    });

    it('should properly interpret escaped brackets as an object field name', () => {
      const res = koncorde.transformer.standardizer.standardize({
        exists: 'foo.ba\\[true\\]'
      });

      should(res).match({
        exists: new NormalizedExists('foo.ba[true]', false, null)
      });
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      return koncorde.register('index', 'collection', {exists: 'foo'})
        .then(subscription => {
          const
            subfilter = koncorde.storage.filters.get(subscription.id).subfilters,
            storage = koncorde.storage.foPairs.get('index', 'collection', 'exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').subfilters).eql(subfilter);
          should(storage.fields.get('foo').values).instanceOf(Map);
          should(storage.fields.get('foo').values.size).eql(0);
        });
    });

    it('should store multiple subfilters on the same condition correctly', () => {
      const filters = koncorde.storage.filters;
      let barSubfilter;

      return koncorde.register('index', 'collection', {exists: 'foo'})
        .then(subscription => {
          barSubfilter = Array.from(filters.get(subscription.id).subfilters)[0];

          return koncorde.register('index', 'collection', {
            and: [
              {equals: {bar: 'qux'}},
              {exists: 'foo'}
            ]
          });
        })
        .then(subscription => {
          const
            quxSubfilter = Array.from(
              filters.get(subscription.id).subfilters)[0],
            storage = koncorde.storage.foPairs.get('index', 'collection', 'exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').subfilters)
            .eql(new Set([barSubfilter, quxSubfilter]));
          should(storage.fields.get('foo').values).instanceOf(Map);
          should(storage.fields.get('foo').values.size).eql(0);
        });
    });

    it('should store a single array search correctly', () => {
      return koncorde.register('index', 'collection', {exists: 'foo["bar"]'})
        .then(subscription => {
          const
            subfilter = Array.from(
              koncorde.storage.filters.get(subscription.id).subfilters)[0],
            storage = koncorde.storage.foPairs.get('index', 'collection', 'exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').subfilters.size).eql(0);
          should(storage.fields.get('foo').values).instanceOf(Map);
          should(storage.fields.get('foo').values.size).eql(1);
          should(storage.fields.get('foo').values.get('bar'))
            .eql(new Set([subfilter]));
        });
    });

    it('should multiple array searches correctly', () => {
      let barSubfilter;

      return koncorde.register('index', 'collection', {exists: 'foo["bar"]'})
        .then(subscription => {
          barSubfilter = Array.from(
            koncorde.storage.filters.get(subscription.id).subfilters)[0];

          return koncorde.register('index', 'collection', {
            and: [
              {exists: 'qux["bar"]'},
              {exists: 'foo["bar"]'}
            ]
          });
        })
        .then(subscription => {
          const
            quxSubfilter = Array.from(
              koncorde.storage.filters.get(subscription.id).subfilters)[0],
            storage = koncorde.storage.foPairs.get('index', 'collection', 'exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').subfilters.size).eql(0);
          should(storage.fields.get('foo').values).instanceOf(Map);
          should(storage.fields.get('foo').values.size).eql(1);
          should(storage.fields.get('foo').values.get('bar'))
            .eql(new Set([barSubfilter, quxSubfilter]));
          should(storage.fields.get('qux').values.get('bar'))
            .eql(new Set([quxSubfilter]));
        });
    });
  });

  describe('#matching', () => {
    it('should match a document with the subscribed field', () => {
      return koncorde.register('index', 'collection', {exists: 'foo'})
        .then(subscription => {
          const result = koncorde.test('index', 'collection', {foo: 'bar'});

          should(result).eql([subscription.id]);
        });
    });

    it('should not match if the document does not contain the searched field', () => {
      return koncorde.register('index', 'collection', {exists: 'foo'})
        .then(() => {
          should(koncorde.test('index', 'collection', {fooo: 'baz'}))
            .be.an.Array().and.empty();
        });
    });

    it('should match a document with the subscribed nested keyword', () => {
      return koncorde.register('index', 'collection', {exists: 'foo.bar.baz'})
        .then(subscription => {
          const result = koncorde.test(
            'index', 'collection', {foo: {bar: {baz: 'qux'}}});

          should(result).eql([subscription.id]);
        });
    });

    it('should not match if the document is in another index', () => {
      return koncorde.register('index', 'collection', {exists: 'foo'})
        .then(() => {
          should(koncorde.test('foobar', 'collection', {foo: 'qux'}))
            .be.an.Array().and.empty();
        });
    });

    it('should not match if the document is in another collection', () => {
      return koncorde.register('index', 'collection', {exists: 'foo'})
        .then(() => {
          should(koncorde.test('index', 'foobar', {foo: 'qux'}))
            .be.an.Array().and.empty();
        });
    });

    it('should match if a searched value is in the document', () => {
      const
        values = ['"foo"', '"bar"', 3.14, 42, false, true, null],
        promises = values.map(
          v => koncorde.register('i', 'c', {exists: `foo[${v}]`}));

      return Promise.all(promises)
        .then(subscriptions => {
          for (let i = 0; i < subscriptions.length; i++) {
            const expected = typeof values[i] === 'string' ?
              values[i].replace(/"/g, '') :
              values[i];

            should(koncorde.test('i', 'c', {foo: ['hello', expected, 'world']}))
              .eql([subscriptions[i].id]);
          }
        });
    });

    it('should not match if an array search is not of the right type', () => {
      return koncorde.register('i', 'c', {exists: 'foo[null]'})
        .then(subscription => {
          should(koncorde.test('i', 'c', {foo: [null]})).eql([subscription.id]);
          should(koncorde.test('i', 'c', {foo: ['null']})).empty();
        });
    });

    it('(see issue #24) should handle duplicates gracefully', () => {
      const filters = {
        and: [
          { equals: { name: 'Leo' } },
          { exists: 'skills.languages["javascript"]' }
        ]
      };

      return koncorde.register('index', 'collection', filters)
        .then(() => {
          const matches = koncorde.test('index', 'collection', {
            name: 'Bob',
            skills: {
              languages: ['pascal', 'javascript', 'python', 'javascript']
            }
          });

          should(matches).be.an.Array().and.empty();
        });
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      return koncorde.register('index', 'collection', {exists: 'foo'})
        .then(subscription => koncorde.remove(subscription.id))
        .then(() => should(koncorde.storage.foPairs._cache).be.empty());
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      let
        idToRemove,
        multiSubfilter;

      return koncorde.register('index', 'collection', {exists: 'foo'})
        .then(subscription => {
          idToRemove = subscription.id;

          return koncorde.register('index', 'collection', {
            and: [
              {equals: {foo: 'qux'}},
              {exists: {field: 'foo'}}
            ]
          });
        })
        .then(subscription => {
          multiSubfilter = Array.from(koncorde.storage.filters.get(subscription.id).subfilters)[0];

          return koncorde.remove(idToRemove);
        })
        .then(() => {
          const storage = koncorde.storage.foPairs.get('index', 'collection', 'exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').subfilters)
            .match(new Set([multiSubfilter]));
          should(storage.fields.get('foo').values).be.instanceOf(Map);
          should(storage.fields.get('foo').values.size).eql(0);
        });
    });

    it('should remove a single subfilter from a multi-filter array condition', () => {
      let
        storage,
        idToRemove,
        singleSubfilter,
        multiSubfilter;

      return koncorde.register('index', 'collection', {exists: 'foo["bar"]'})
        .then(subscription => {
          idToRemove = subscription.id;
          storage = koncorde.storage.foPairs.get('index', 'collection', 'exists');
          singleSubfilter = Array.from(koncorde.storage.filters.get(subscription.id).subfilters)[0];

          return koncorde.register('index', 'collection', {
            and: [
              {equals: {foo: 'qux'}},
              {exists: {field: 'foo["bar"]'}}
            ]
          });
        })
        .then(subscription => {
          multiSubfilter = Array.from(
            koncorde.storage.filters.get(subscription.id).subfilters)[0];
          should(storage.fields.get('foo').values.get('bar'))
            .match(new Set([singleSubfilter, multiSubfilter]));
          should(storage.fields.get('foo').subfilters.size).eql(0);
          return koncorde.remove(idToRemove);
        })
        .then(() => {
          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').subfilters.size).eql(0);
          should(storage.fields.get('foo').values.get('bar'))
            .match(new Set([multiSubfilter]));
        });
    });

    it('should remove a field from the list if its last subfilter is removed', () => {
      let
        fooSubfilter;

      return koncorde.register('index', 'collection', {exists: 'foo'})
        .then(subscription => {
          fooSubfilter = Array.from(koncorde.storage.filters.get(subscription.id).subfilters)[0];

          return koncorde.register('index', 'collection', {exists: 'bar'});
        })
        .then(subscription => {
          const operand = koncorde.storage.foPairs
            .get('index', 'collection', 'exists');

          should(operand.fields).have.keys('foo', 'bar');
          return koncorde.remove(subscription.id);
        })
        .then(() => {
          const storage = koncorde.storage.foPairs.get('index', 'collection', 'exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').subfilters)
            .match(new Set([fooSubfilter]));
          should(storage.fields.get('foo').values).be.instanceOf(Map);
          should(storage.fields.get('foo').values.size).eql(0);
          should(storage.fields.get('bar')).be.undefined();
        });
    });

    it('should remove a field from the list if its last array search value is removed', () => {
      let
        fooSubfilter;

      return koncorde.register('index', 'collection', {exists: 'foo'})
        .then(subscription => {
          fooSubfilter = Array.from(koncorde.storage.filters.get(subscription.id).subfilters)[0];

          return koncorde.register('index', 'collection', {exists: 'bar["foo"]'});
        })
        .then(subscription => koncorde.remove(subscription.id))
        .then(() => {
          const storage = koncorde.storage.foPairs.get('index', 'collection', 'exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').subfilters).match(new Set([fooSubfilter]));
          should(storage.fields.get('foo').values).be.instanceOf(Map);
          should(storage.fields.get('foo').values.size).eql(0);
          should(storage.fields.get('bar')).be.undefined();
        });
    });

    it('should keep a field if a field existence test remains', () => {
      let
        fooSubfilter;

      return koncorde.register('index', 'collection', {exists: 'foo'})
        .then(subscription => {
          fooSubfilter = Array.from(koncorde.storage.filters.get(subscription.id).subfilters)[0];

          return koncorde.register('index', 'collection', {exists: 'foo["bar"]'});
        })
        .then(subscription => koncorde.remove(subscription.id))
        .then(() => {
          const storage = koncorde.storage.foPairs.get('index', 'collection', 'exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').subfilters).match(new Set([fooSubfilter]));
          should(storage.fields.get('foo').values).be.instanceOf(Map);
          should(storage.fields.get('foo').values.size).eql(0);
        });
    });

    it('should keep a field if an array search test remains', () => {
      let
        fooSubfilter;

      return koncorde.register('index', 'collection', {exists: 'foo["bar"]'})
        .then(subscription => {
          fooSubfilter = Array.from(koncorde.storage.filters.get(subscription.id).subfilters)[0];

          return koncorde.register('index', 'collection', {exists: 'foo'});
        })
        .then(subscription => koncorde.remove(subscription.id))
        .then(() => {
          const storage = koncorde.storage.foPairs.get('index', 'collection', 'exists');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').subfilters.size).eql(0);
          should(storage.fields.get('foo').values).be.instanceOf(Map);
          should(storage.fields.get('foo').values.size).eql(1);
          should(storage.fields.get('foo').values.get('bar'))
            .eql(new Set([fooSubfilter]));
        });
    });
  });
});
