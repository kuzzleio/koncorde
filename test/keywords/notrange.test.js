'use strict';

const
  should = require('should'),
  FieldOperand = require('../../lib/storage/objects/fieldOperand'),
  DSL = require('../../'),
  RangeCondition = require('../../lib/storage/objects/rangeCondition');

describe('DSL.keyword.notrange', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lt: 100}}}})
        .then(subscription => {
          const
            subfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            store = dsl.storage.foPairs.get('index', 'collection', 'notrange');

          should(store).be.instanceOf(FieldOperand);
          should(store.keys).eql(new Set(['foo']));
          should(store.fields.foo.conditions.size).be.eql(1);

          const rangeCondition = Array.from(store.fields.foo.conditions.values())[0];
          should(rangeCondition).instanceOf(RangeCondition);
          should(rangeCondition.subfilters).eql(new Set([subfilter]));
          should(rangeCondition.low).approximately(42, 1e-9);
          should(rangeCondition.high).approximately(100, 1e-9);
          should(store.fields.foo.tree).be.an.Object();
        });
    });

    it('should store multiple conditions on the same field correctly', () => {
      let sf1;

      return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lt: 100}}}})
        .then(subscription => {
          sf1 = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];

          return dsl.register('index', 'collection', {
            and: [
              {not: {range: {foo: {gte: 10, lte: 78}}}},
              {not: {range: {foo: {gt: 0, lt: 50}}}}
            ]
          });
        })
        .then(subscription => {
          const
            sf2 = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            store = dsl.storage.foPairs.get('index', 'collection', 'notrange');

          should(store).be.instanceOf(FieldOperand);
          should(store.keys).eql(new Set(['foo']));
          should(store.fields.foo.conditions.size).be.eql(3);

          const cd1 = store.fields.foo.conditions.get(Array.from(sf1.conditions)[0].id);

          should(cd1).instanceOf(RangeCondition);
          should(cd1.subfilters).eql(new Set([sf1]));
          should(cd1.low).exactly(42);
          should(cd1.high).exactly(100);

          const cd2 = store.fields.foo.conditions.get(Array.from(sf2.conditions)[0].id);

          should(cd2).instanceOf(RangeCondition);
          should(cd2.subfilters).eql(new Set([sf2]));
          should(cd2.low).approximately(10, 1e-9);
          should(cd2.high).approximately(78, 1e-9);

          const cd3 = store.fields.foo.conditions.get(Array.from(sf2.conditions)[1].id);

          should(cd3).instanceOf(RangeCondition);
          should(cd3.subfilters).eql(new Set([sf2]));
          should(cd3.low).exactly(0);
          should(cd3.high).exactly(50);

          should(store.fields.foo.tree).be.an.Object();
        });
    });
  });

  describe('#matching', () => {
    it('should match a document with its value outside the range', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lt: 110}}}})
        .then(subscription => {
          should(dsl.test('index', 'collection', {foo: -89})).eql([subscription.id]);
        });
    });

    it('should match a document with its value exactly on the lower exclusive boundary', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lt: 110}}}})
        .then(subscription => {
          should(dsl.test('index', 'collection', {foo: 42})).eql([subscription.id]);
        });
    });

    it('should match a document with its value exactly on the upper exclusive boundary', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lt: 110}}}})
        .then(subscription => {
          should(dsl.test('index', 'collection', {foo: 110})).be.eql([subscription.id]);
        });
    });

    it('should not match a document with its value exactly on the lower inclusive boundary', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gte: 42, lt: 110}}}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: 42})).be.an.Array().and.be.empty();
        });
    });

    it('should not match a document with its value exactly on the upper inclusive boundary', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lte: 110}}}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: 110})).be.an.Array().and.be.empty();
        });
    });

    it('should match a document with only a lower boundary range', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gt: -10}}}})
        .then(subscription => {
          should(dsl.test('index', 'collection', {foo: -25})).be.eql([subscription.id]);
        });
    });

    it('should match a document with only an upper boundary range', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {lt: -10}}}})
        .then(subscription => {
          should(dsl.test('index', 'collection', {foo: 105})).be.eql([subscription.id]);
        });
    });

    it('should return all notrange filters attached to the field if the document does not contain the registered field', () => {
      return dsl.register('i', 'c', {not: {range: {foo: {lt: -10}}}})
        .then(() => dsl.register('i', 'c', {not: {range: {foo: {gt: 42}}}}))
        .then(() => dsl.register('i', 'c', {not: {range: {foo: {gte: -20, lt: 9999999}}}}))
        .then(() => {
          should(dsl.test('i', 'c', {bar: 105}))
            .be.an.Array()
            .length(3);
        });
    });

    it('should return all notrange filters attached to the field if the document searched field is not a number', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {lt: -10}}}})
        .then(response => {
          should(dsl.test('index', 'collection', {bar: 'baz'}))
            .be.eql([response.id]);
        });
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gte: 42, lte: 110}}}})
        .then(subscription => dsl.remove(subscription.id))
        .then(() => should(dsl.storage.foPairs._cache).be.empty());
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      let
        storage,
        multiSubfilter;

      return dsl.register('index', 'collection', {not: {range: {foo: {gte: 42, lte: 110}}}})
        .then(subscription => {
          storage = dsl.storage.foPairs.get('index', 'collection', 'notrange');
          multiSubfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];

          return dsl.register('index', 'collection', {
            and: [
              {not: {range: {foo: {lt: 50}}}},
              {not: {range: {foo: {gt: 2}}}},
              {not: {range: {foo: {gte: 42, lte: 110}}}}
            ]
          });
        })
        .then(subscription => {
          should(storage.fields.foo.conditions.size).eql(3);
          return dsl.remove(subscription.id);
        })
        .then(() => {
          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo']));
          should(storage.fields.foo.conditions.size).eql(1);

          const rcd = storage.fields.foo.conditions.get(Array.from(multiSubfilter.conditions)[0].id);
          should(rcd).instanceOf(RangeCondition);
          should(rcd.subfilters).match(new Set([multiSubfilter]));
          should(rcd.low).approximately(42, 1e-9);
          should(rcd.high).approximately(110, 1e-9);
        });
    });

    it('should remove a field from the list if its last subfilter is removed', () => {
      let
        idToRemove,
        multiSubfilter;

      return dsl.register('index', 'collection', {not: {range: {bar: {gt: 42, lt: 110}}}})
        .then(subscription => {
          idToRemove = subscription.id;

          return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lt: 110}}}});
        })
        .then(subscription => {
          multiSubfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];
          should(dsl.storage.foPairs.get('index', 'collection', 'notrange').keys).eql(new Set(['bar', 'foo']));
          return dsl.remove(idToRemove);
        })
        .then(() => {
          const storage = dsl.storage.foPairs.get('index', 'collection', 'notrange');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo']));
          should(storage.fields.foo.conditions.size).eql(1);

          const rcd = storage.fields.foo.conditions.get(Array.from(multiSubfilter.conditions)[0].id);

          should(rcd).instanceOf(RangeCondition);
          should(rcd.subfilters).match(new Set([multiSubfilter]));
          should(rcd.low).eql(42);
          should(rcd.high).eql(110);
          should(storage.fields.bar).be.undefined();
        });
    });
  });
});
