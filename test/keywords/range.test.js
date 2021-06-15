const should = require('should/as-function');

const FieldOperand = require('../../lib/engine/objects/fieldOperand');
const { RangeCondition } = require('../../lib/engine/objects/rangeCondition');
const { Koncorde } = require('../../');

describe('Koncorde.keyword.range', () => {
  let koncorde;
  let engine;

  beforeEach(() => {
    koncorde = new Koncorde();
    engine = koncorde.engines.get(null);
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => koncorde.validate({range: {}}))
        .throw({
          keyword: 'range',
          message: '"range": expected object to have exactly 1 property, got 0',
          path: 'range',
        });
    });

    it('should reject filters with more than 1 field', () => {
      should(() => koncorde.validate({range: {foo: 'foo', bar: 'bar'}}))
        .throw({
          keyword: 'range',
          message: '"range": expected object to have exactly 1 property, got 2',
          path: 'range',
        });
    });

    it('should reject an empty field definition', () => {
      should(() => koncorde.validate({range: {foo: {}}}))
        .throw({
          keyword: 'range',
          message: '"range.foo": must be a non-empty object',
          path: 'range.foo',
        });
    });

    it('should reject a field definition containing an unrecognized range keyword', () => {
      should(() => koncorde.validate({range: {foo: {gt: 42, lt: 113, bar: 'baz'}}}))
        .throw({
          keyword: 'range',
          message: '"range.foo": "bar" is not an allowed attribute (allowed: gt,gte,lt,lte)',
          path: 'range.foo',
        });
    });

    it('should reject a field definition with a range keyword not containing a number', () => {
      should(() => koncorde.validate({range: {foo: {gt: '42', lt: 113}}}))
        .throw({
          keyword: 'range',
          message: '"range.foo.gt": must be a number',
          path: 'range.foo.gt',
        });
    });

    it('should reject a field definition containing more than 1 lower boundary', () => {
      should(() => koncorde.validate({range: {foo: {gt: 42, gte: 13, lt: 113}}}))
        .throw({
          keyword: 'range',
          message: '"range.foo": only 1 lower boundary allowed',
          path: 'range.foo',
        });
    });

    it('should reject a field definition containing more than 1 upper boundary', () => {
      should(() => koncorde.validate({range: {foo: {gt: 42, lt: 113, lte: 200}}}))
        .throw({
          keyword: 'range',
          message: '"range.foo": only 1 upper boundary allowed',
          path: 'range.foo',
        });
    });

    it('should validate a valid range filter', () => {
      should(() => koncorde.validate({range: {foo: {gt: 42, lte: 200}}}))
        .not.throw();
    });

    it('should reject a range filter with inverted boundaries', () => {
      should(() => koncorde.validate({range: {foo: {lt: 42, gt: 200}}}))
        .throw({
          keyword: 'range',
          message: '"range.foo": lower boundary must be strictly inferior to the upper one',
          path: 'range.foo',
        });
    });
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      const filter = {range: {foo: {gt: 42, lte: 113}}};
      should(koncorde.transformer.standardizer.standardize(filter)).match(filter);
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      const id = koncorde.register({
        range: {
          foo: {
            gt: 42,
            lt: 100,
          },
        },
      });

      const subfilter = Array.from(engine.filters.get(id).subfilters)[0];
      const store = engine.foPairs.get('range');

      should(store).be.instanceOf(FieldOperand);
      should(store.fields.get('foo').conditions.size).be.eql(1);

      const rangeInfo = Array
        .from(store.fields.get('foo').conditions.values())[0];

      should(rangeInfo).instanceOf(RangeCondition);
      should(rangeInfo.subfilters).match(new Set([subfilter]));
      should(rangeInfo.low).approximately(42, 1e-9);
      should(rangeInfo.high).approximately(100, 1e-9);
    });

    it('should store multiple conditions on the same field correctly', () => {
      const id1 = koncorde.register({
        range: {
          foo: {
            gt: 42,
            lt: 100,
          },
        },
      });

      const id2 = koncorde.register({
        range: {
          foo: {
            gte: 10,
            lte: 78,
          },
        },
      });

      const sf1 = Array.from(engine.filters.get(id1).subfilters)[0];
      const sf2 = Array.from(engine.filters.get(id2).subfilters)[0];
      const store = engine.foPairs.get('range');

      should(store).be.instanceOf(FieldOperand);
      should(store.fields.get('foo').conditions.size).be.eql(2);

      let rangeInfo = store.fields.get('foo').conditions
        .get(Array.from(sf1.conditions)[0].id);
      should(rangeInfo).instanceOf(RangeCondition);
      should(rangeInfo.subfilters).match(new Set([sf1]));
      should(rangeInfo.low).approximately(42, 1e-9);
      should(rangeInfo.high).approximately(100, 1e-9);

      rangeInfo = store.fields.get('foo').conditions
        .get(Array.from(sf2.conditions)[0].id);
      should(rangeInfo).instanceOf(RangeCondition);
      should(rangeInfo.subfilters).match(new Set([sf2]));
      should(rangeInfo.low).be.exactly(10);
      should(rangeInfo.high).be.exactly(78);

      should(store.fields.get('foo').tree).be.an.Object();
    });
  });

  describe('#matching', () => {
    it('should match a document with its value in the range', () => {
      const id = koncorde.register({
        range: {
          foo: {
            gt: 42,
            lt: 110,
          },
        },
      });

      should(koncorde.test({ foo: 73 })).eql([id]);
    });

    it('should match a document with its value exactly on the lower inclusive boundary', () => {
      const id = koncorde.register({
        range: {
          foo: {
            gte: 42,
            lt: 110,
          },
        },
      });

      should(koncorde.test({ foo: 42 })).eql([id]);
    });

    it('should match a document with its value exactly on the upper inclusive boundary', () => {
      const id = koncorde.register({
        range: {
          foo: {
            gt: 42,
            lte: 110,
          },
        },
      });

      should(koncorde.test({ foo: 110 })).eql([id]);
    });

    it('should not match a document with its value exactly on the lower exclusive boundary', () => {
      koncorde.register({
        range: {
          foo: {
            gt: 42,
            lt: 110,
          },
        },
      });

      should(koncorde.test({ foo: 42 })).be.an.Array().and.be.empty();
    });

    it('should not match a document with its value exactly on the upper exclusive boundary', () => {
      koncorde.register({
        range: {
          foo: {
            gt: 42,
            lt: 110,
          },
        },
      });

      should(koncorde.test({ foo: 110 })).be.an.Array().and.be.empty();
    });

    it('should match a document with only a lower boundary range', () => {
      const id = koncorde.register({
        range: {
          foo: { gt: -10 },
        },
      });

      should(koncorde.test({ foo: -5 })).eql([id]);
    });

    it('should match a document with only an upper boundary range', () => {
      const id = koncorde.register({
        range: {
          foo: {lt: -10},
        },
      });

      should(koncorde.test({ foo: -105 })).eql([id]);
    });

    it('should return an empty array if the document does not contain the registered field', () => {
      koncorde.register({ range: { foo: { lt: -10 } } });

      should(koncorde.test({ bar: -105 })).be.an.Array().and.be.empty();
    });

    it('should return an empty array if the document searched field is not a number', () => {
      koncorde.register({ range: { foo: { lt: -10 } } });

      should(koncorde.test({ bar: 'baz' })).be.an.Array().and.be.empty();
    });

    it('should consider 0 as a valid value', () => {
      const id = koncorde.register({ range: { foo: { lt: 42 } } });

      should(koncorde.test({ foo: 0 })).be.eql([id]);
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const id = koncorde.register({
        range: {
          foo: {
            gte: 42,
            lte: 110,
          },
        },
      });

      koncorde.remove(id);

      should(engine.foPairs).be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const id1 = koncorde.register({
        range: {
          foo: {
            gt: 42,
            lt: 110,
          },
        },
      });

      const id2 = koncorde.register({
        and: [
          { range: { foo: { gt: 42, lt: 110 } } },
          { range: { foo: { lt: 50 } } },
        ],
      });

      const storage = engine.foPairs.get('range');
      const multiSubfilter = Array.from(engine.filters.get(id1).subfilters)[0];

      should(storage.fields.get('foo').conditions.size).eql(2);

      koncorde.remove(id2);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').conditions.size).eql(1);

      const rangeInfo = Array
        .from(storage.fields.get('foo').conditions.values())[0];

      should(rangeInfo.subfilters).match(new Set([multiSubfilter]));
      should(rangeInfo.low).approximately(42, 1e-9);
      should(rangeInfo.high).approximately(110, 1e-9);
    });

    it('should remove a field from the list if its last subfilter is removed', () => {
      const id1 = koncorde.register({
        range: {
          bar: {
            gt: 42,
            lt: 110,
          },
        },
      });

      const id2 = koncorde.register({
        range: {
          foo: {
            gte: 42,
            lte: 110,
          },
        },
      });

      const multiSubfilter = Array.from(engine.filters.get(id2).subfilters)[0];
      const storage = engine.foPairs.get('range');

      should(storage.fields).have.keys('bar', 'foo');

      koncorde.remove(id1);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').conditions.size).eql(1);

      const rangeInfo = Array.from(storage.fields.get('foo').conditions.values())[0];
      should(rangeInfo.subfilters).match(new Set([multiSubfilter]));
      should(rangeInfo.low).approximately(42, 1e-9);
      should(rangeInfo.high).approximately(110, 1e-9);
      should(storage.fields.get('bar')).be.undefined();
    });
  });
});
