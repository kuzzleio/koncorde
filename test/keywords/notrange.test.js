const should = require('should/as-function');

const FieldOperand = require('../../lib/engine/objects/fieldOperand');
const { Koncorde } = require('../../');
const { RangeCondition } = require('../../lib/engine/objects/rangeCondition');

describe('Koncorde.keyword.notrange', () => {
  let koncorde;
  let engine;

  beforeEach(() => {
    koncorde = new Koncorde();
    engine = koncorde.engines.get(null);
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      const id = koncorde.register({
        not: {
          range: {
            foo: {
              gt: 42,
              lt: 100,
            },
          },
        },
      });
      const subfilter = Array.from(engine.filters.get(id).subfilters)[0];
      const store = engine.foPairs.get('notrange');

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
      const id1 = koncorde.register({
        not: {
          range: {
            foo: {
              gt: 42,
              lt: 100,
            },
          },
        },
      });

      const id2 = koncorde.register({
        and: [
          { not: { range: { foo: { gte: 10, lte: 78 } } } },
          { not: { range: { foo: { gt: 0, lt: 50 } } } },
        ],
      });

      const sf1 = Array.from(engine.filters.get(id1).subfilters)[0];
      const sf2 = Array.from(engine.filters.get(id2).subfilters)[0];
      const store = engine.foPairs.get('notrange');

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
      const id = koncorde.register({
        not: {
          range: {
            foo: {
              gt: 42,
              lt: 110,
            },
          },
        },
      });

      should(koncorde.test({ foo: -89 })).eql([id]);
    });

    it('should match a document with its value exactly on the lower exclusive boundary', () => {
      const id = koncorde.register({
        not: {
          range: {
            foo: {
              gt: 42,
              lt: 110,
            },
          },
        },
      });

      should(koncorde.test({ foo: 42 })).eql([id]);
    });

    it('should match a document with its value exactly on the upper exclusive boundary', () => {
      const id = koncorde.register({
        not: {
          range: {
            foo: {
              gt: 42,
              lt: 110,
            },
          },
        },
      });

      should(koncorde.test({ foo: 110 })).be.eql([id]);
    });

    it('should not match a document with its value exactly on the lower inclusive boundary', () => {
      koncorde.register({
        not: {
          range: {
            foo: {
              gte: 42,
              lt: 110,
            },
          },
        },
      });

      should(koncorde.test({ foo: 42 })).be.an.Array().and.be.empty();
    });

    it('should not match a document with its value exactly on the upper inclusive boundary', () => {
      koncorde.register({
        not: {
          range: {
            foo: {
              gt: 42,
              lte: 110,
            },
          },
        },
      });

      should(koncorde.test({ foo: 110 })).be.an.Array().and.be.empty();
    });

    it('should match a document with only a lower boundary range', () => {
      const id = koncorde.register({
        not: {
          range: {
            foo: { gt: -10 },
          },
        },
      });

      should(koncorde.test({ foo: -25 })).be.eql([id]);
    });

    it('should match a document with only an upper boundary range', () => {
      const id = koncorde.register({
        not: {
          range: {
            foo: { lt: -10 },
          },
        },
      });

      should(koncorde.test({ foo: 105 })).be.eql([id]);
    });

    it('should return all notrange filters attached to the field if the document does not contain the registered field', () => {
      koncorde.register({
        not: {
          range: {
            foo: { lt: -10 },
          },
        },
      });

      koncorde.register({
        not: {
          range: {
            foo: { gt: 42 },
          },
        },
      });

      koncorde.register({
        not: {
          range: {
            foo: {
              gte: -20,
              lt: 9999999,
            },
          },
        },
      });

      should(koncorde.test({ bar: 105 })).be.an.Array().length(3);
    });

    it('should return all notrange filters attached to the field if the document searched field is not a number', () => {
      const id = koncorde.register({
        not: {
          range: {
            foo: { lt: -10 },
          },
        },
      });

      should(koncorde.test({ bar: 'baz' })).be.eql([id]);
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const id = koncorde.register({
        not: {
          range: {
            foo: {
              gte: 42,
              lte: 110,
            },
          },
        },
      });

      koncorde.remove(id);
      should(engine.foPairs).be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const id1 = koncorde.register({
        not: {
          range: {
            foo: {
              gte: 42,
              lte: 110,
            },
          },
        },
      });

      const id2 = koncorde.register({
        and: [
          { not: { range: { foo: { lt: 50 } } } },
          { not: { range: { foo: { gt: 2 } } } },
          { not: { range: { foo: { gte: 42, lte: 110 } } } },
        ]
      });

      const storage = engine.foPairs.get('notrange');

      should(storage.fields.get('foo').conditions.size).eql(3);

      koncorde.remove(id2);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').conditions.size).eql(1);

      const multiSubfilter = Array.from(engine.filters.get(id1).subfilters)[0];
      const rcd = storage.fields.get('foo').conditions
        .get(Array.from(multiSubfilter.conditions)[0].id);

      should(rcd).instanceOf(RangeCondition);
      should(rcd.subfilters).match(new Set([multiSubfilter]));
      should(rcd.low).approximately(42, 1e-9);
      should(rcd.high).approximately(110, 1e-9);
    });

    it('should remove a field from the list if its last subfilter is removed', () => {
      const id1 = koncorde.register({
        not: {
          range: {
            bar: {
              gt: 42,
              lt: 110,
            },
          },
        },
      });

      const id2 = koncorde.register({
        not: {
          range: {
            foo: {
              gt: 42,
              lt: 110,
            },
          },
        },
      });

      const storage = engine.foPairs.get('notrange');

      should(storage.fields).have.keys('bar', 'foo');

      koncorde.remove(id1);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').conditions.size).eql(1);

      const multiSubfilter = Array.from(engine.filters.get(id2).subfilters)[0];
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
