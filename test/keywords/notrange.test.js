const should = require('should/as-function');

const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const DSL = require('../../');
const RangeCondition = require('../../lib/storage/objects/rangeCondition');

describe('DSL.keyword.notrange', () => {
  let dsl;
  let filters;
  let foPairs;

  beforeEach(() => {
    dsl = new DSL();
    filters = dsl.storage.filters;
    foPairs = dsl.storage.foPairs;
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      const subscription = dsl.register('index', 'collection', {
        not: {
          range: {
            foo: {
              gt: 42,
              lt: 100,
            },
          },
        },
      });
      const subfilter = Array.from(filters.get(subscription.id).subfilters)[0];
      const store = foPairs.get('index', 'collection', 'notrange');

      should(store).be.instanceOf(FieldOperand);
      should(store.fields.get('foo').conditions.size).be.eql(1);

      const rangeCondition = Array.from(store.fields.get('foo').conditions.values())[0];
      should(rangeCondition).instanceOf(RangeCondition);
      should(rangeCondition.subfilters).eql(new Set([subfilter]));
      should(rangeCondition.low).approximately(42, 1e-9);
      should(rangeCondition.high).approximately(100, 1e-9);
      should(store.fields.get('foo').tree).be.an.Object();
    });

    it('should store multiple conditions on the same field correctly', () => {
      const sub1 = dsl.register('index', 'collection', {
        not: {
          range: {
            foo: {
              gt: 42,
              lt: 100,
            },
          },
        },
      });

      const sub2 = dsl.register('index', 'collection', {
        and: [
          {not: {range: {foo: {gte: 10, lte: 78}}}},
          {not: {range: {foo: {gt: 0, lt: 50}}}},
        ],
      });

      const sf1 = Array.from(filters.get(sub1.id).subfilters)[0];
      const sf2 = Array.from(filters.get(sub2.id).subfilters)[0];
      const store = foPairs.get('index', 'collection', 'notrange');

      should(store).be.instanceOf(FieldOperand);
      should(store.fields.get('foo').conditions.size).be.eql(3);

      const cd1 = store.fields.get('foo').conditions
        .get(Array.from(sf1.conditions)[0].id);

      should(cd1).instanceOf(RangeCondition);
      should(cd1.subfilters).eql(new Set([sf1]));
      should(cd1.low).exactly(42);
      should(cd1.high).exactly(100);

      const cd2 = store.fields.get('foo').conditions
        .get(Array.from(sf2.conditions)[0].id);

      should(cd2).instanceOf(RangeCondition);
      should(cd2.subfilters).eql(new Set([sf2]));
      should(cd2.low).approximately(10, 1e-9);
      should(cd2.high).approximately(78, 1e-9);

      const cd3 = store.fields.get('foo').conditions
        .get(Array.from(sf2.conditions)[1].id);

      should(cd3).instanceOf(RangeCondition);
      should(cd3.subfilters).eql(new Set([sf2]));
      should(cd3.low).exactly(0);
      should(cd3.high).exactly(50);

      should(store.fields.get('foo').tree).be.an.Object();
    });
  });

  describe('#matching', () => {
    it('should match a document with its value outside the range', () => {
      const subscription = dsl.register('index', 'collection', {
        not: {
          range: {
            foo: {
              gt: 42,
              lt: 110,
            },
          },
        },
      });

      should(dsl.test('index', 'collection', {foo: -89})).eql([subscription.id]);
    });

    it('should match a document with its value exactly on the lower exclusive boundary', () => {
      const subscription = dsl.register('index', 'collection', {
        not: {
          range: {
            foo: {
              gt: 42,
              lt: 110,
            },
          },
        },
      });

      should(dsl.test('index', 'collection', {foo: 42})).eql([subscription.id]);
    });

    it('should match a document with its value exactly on the upper exclusive boundary', () => {
      const subscription = dsl.register('index', 'collection', {
        not: {
          range: {
            foo: {
              gt: 42,
              lt: 110,
            },
          },
        },
      });

      should(dsl.test('index', 'collection', {foo: 110}))
        .be.eql([subscription.id]);
    });

    it('should not match a document with its value exactly on the lower inclusive boundary', () => {
      dsl.register('index', 'collection', {
        not: {
          range: {
            foo: {
              gte: 42,
              lt: 110,
            },
          },
        },
      });

      should(dsl.test('index', 'collection', {foo: 42}))
        .be.an.Array().and.be.empty();
    });

    it('should not match a document with its value exactly on the upper inclusive boundary', () => {
      dsl.register('index', 'collection', {
        not: {
          range: {
            foo: {
              gt: 42,
              lte: 110,
            },
          },
        },
      });

      should(dsl.test('index', 'collection', {foo: 110}))
        .be.an.Array().and.be.empty();
    });

    it('should match a document with only a lower boundary range', () => {
      const subscription = dsl.register('index', 'collection', {
        not: {
          range: {
            foo: { gt: -10 },
          },
        },
      });

      should(dsl.test('index', 'collection', {foo: -25}))
        .be.eql([subscription.id]);
    });

    it('should match a document with only an upper boundary range', () => {
      const subscription = dsl.register('index', 'collection', {
        not: {
          range: {
            foo: { lt: -10 },
          },
        },
      });

      should(dsl.test('index', 'collection', {foo: 105}))
        .be.eql([subscription.id]);
    });

    it('should return all notrange filters attached to the field if the document does not contain the registered field', () => {
      dsl.register('i', 'c', {
        not: {
          range: {
            foo: { lt: -10 },
          },
        },
      });

      dsl.register('i', 'c', {
        not: {
          range: {
            foo: { gt: 42 },
          },
        },
      });

      dsl.register('i', 'c', {
        not: {
          range: {
            foo: {
              gte: -20,
              lt: 9999999,
            },
          },
        },
      });

      should(dsl.test('i', 'c', {bar: 105}))
        .be.an.Array()
        .length(3);
    });

    it('should return all notrange filters attached to the field if the document searched field is not a number', () => {
      const subscription = dsl.register('index', 'collection', {
        not: {
          range: {
            foo: { lt: -10 },
          },
        },
      });

      should(dsl.test('index', 'collection', {bar: 'baz'}))
        .be.eql([subscription.id]);
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const subscription = dsl.register('index', 'collection', {
        not: {
          range: {
            foo: {
              gte: 42,
              lte: 110,
            },
          },
        },
      });

      dsl.remove(subscription.id);
      should(foPairs._cache).be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const sub1 = dsl.register('index', 'collection', {
        not: {
          range: {
            foo: {
              gte: 42,
              lte: 110,
            },
          },
        },
      });

      const sub2 = dsl.register('index', 'collection', {
        and: [
          {not: {range: {foo: {lt: 50}}}},
          {not: {range: {foo: {gt: 2}}}},
          {not: {range: {foo: {gte: 42, lte: 110}}}},
        ]
      });

      const storage = foPairs.get('index', 'collection', 'notrange');

      should(storage.fields.get('foo').conditions.size).eql(3);

      dsl.remove(sub2.id);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').conditions.size).eql(1);

      const multiSubfilter = Array.from(filters.get(sub1.id).subfilters)[0];
      const rcd = storage.fields.get('foo').conditions
        .get(Array.from(multiSubfilter.conditions)[0].id);

      should(rcd).instanceOf(RangeCondition);
      should(rcd.subfilters).match(new Set([multiSubfilter]));
      should(rcd.low).approximately(42, 1e-9);
      should(rcd.high).approximately(110, 1e-9);
    });

    it('should remove a field from the list if its last subfilter is removed', () => {
      const sub1 = dsl.register('index', 'collection', {
        not: {
          range: {
            bar: {
              gt: 42,
              lt: 110,
            },
          },
        },
      });

      const sub2 = dsl.register('index', 'collection', {
        not: {
          range: {
            foo: {
              gt: 42,
              lt: 110,
            },
          },
        },
      });

      const operand = dsl.storage.foPairs
        .get('index', 'collection', 'notrange');

      should(operand.fields).have.keys('bar', 'foo');

      dsl.remove(sub1.id);

      const storage = foPairs.get('index', 'collection', 'notrange');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').conditions.size).eql(1);

      const multiSubfilter = Array.from(filters.get(sub2.id).subfilters)[0];
      const rcd = storage.fields.get('foo').conditions
        .get(Array.from(multiSubfilter.conditions)[0].id);

      should(rcd).instanceOf(RangeCondition);
      should(rcd.subfilters).match(new Set([multiSubfilter]));
      should(rcd.low).eql(42);
      should(rcd.high).eql(110);
      should(storage.fields.get('bar')).be.undefined();
    });
  });
});
