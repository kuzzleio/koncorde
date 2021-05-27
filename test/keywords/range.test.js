const should = require('should/as-function');

const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const RangeCondition = require('../../lib/storage/objects/rangeCondition');
const DSL = require('../../');

describe('DSL.keyword.range', () => {
  let dsl;
  let filters;
  let foPairs;

  beforeEach(() => {
    dsl = new DSL();
    filters = dsl.storage.filters;
    foPairs = dsl.storage.foPairs;
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => dsl.validate({range: {}}))
        .throw('"range" must be a non-empty object');
    });

    it('should reject filters with more than 1 field', () => {
      should(() => dsl.validate({range: {foo: 'foo', bar: 'bar'}}))
        .throw('"range" can contain only one attribute');
    });

    it('should reject an empty field definition', () => {
      should(() => dsl.validate({range: {foo: {}}}))
        .throw('"range.foo" must be a non-empty object');
    });

    it('should reject a field definition containing an unrecognized range keyword', () => {
      should(() => dsl.validate({range: {foo: {gt: 42, lt: 113, bar: 'baz'}}}))
        .throw('"range.foo" accepts only the following attributes : gt, gte, lt, lte');
    });

    it('should reject a field definition with a range keyword not containing a number', () => {
      should(() => dsl.validate({range: {foo: {gt: '42', lt: 113}}}))
        .throw('"range.foo.gt" must be a number');
    });

    it('should reject a field definition containing more than 1 lower boundary', () => {
      should(() => dsl.validate({range: {foo: {gt: 42, gte: 13, lt: 113}}}))
        .throw('"range.foo:" only 1 lower boundary allowed');
    });

    it('should reject a field definition containing more than 1 upper boundary', () => {
      should(() => dsl.validate({range: {foo: {gt: 42, lt: 113, lte: 200}}}))
        .throw('"range.foo:" only 1 upper boundary allowed');
    });

    it('should validate a valid range filter', () => {
      should(() => dsl.validate({range: {foo: {gt: 42, lte: 200}}}))
        .not.throw();
    });

    it('should reject a range filter with inverted boundaries', () => {
      should(() => dsl.validate({range: {foo: {lt: 42, gt: 200}}}))
        .throw('"range.foo:" lower boundary must be strictly inferior to the upper one');
    });
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      const filter = {range: {foo: {gt: 42, lte: 113}}};
      should(dsl.transformer.standardizer.standardize(filter)).match(filter);
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      const subscription = dsl.register('index', 'collection', {
        range: {
          foo: {
            gt: 42,
            lt: 100,
          },
        },
      });

      const subfilter = Array.from(filters.get(subscription.id).subfilters)[0];
      const store = foPairs.get('index', 'collection', 'range');

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
      const sub1 = dsl.register('index', 'collection', {
        range: {
          foo: {
            gt: 42,
            lt: 100,
          },
        },
      });

      const sub2 = dsl.register('index', 'collection', {
        range: {
          foo: {
            gte: 10,
            lte: 78,
          },
        },
      });

      const sf1 = Array.from(filters.get(sub1.id).subfilters)[0];
      const sf2 = Array.from(filters.get(sub2.id).subfilters)[0];
      const store = foPairs.get('index', 'collection', 'range');

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
      const subscription = dsl.register('index', 'collection', {
        range: {
          foo: {
            gt: 42,
            lt: 110,
          },
        },
      });

      should(dsl.test('index', 'collection', {foo: 73})).eql([subscription.id]);
    });

    it('should match a document with its value exactly on the lower inclusive boundary', () => {
      const subscription = dsl.register('index', 'collection', {
        range: {
          foo: {
            gte: 42,
            lt: 110,
          },
        },
      });

      should(dsl.test('index', 'collection', {foo: 42})).eql([subscription.id]);
    });

    it('should match a document with its value exactly on the upper inclusive boundary', () => {
      const subscription = dsl.register('index', 'collection', {
        range: {
          foo: {
            gt: 42,
            lte: 110,
          },
        },
      });

      should(dsl.test('index', 'collection', {foo: 110})).eql([subscription.id]);
    });

    it('should not match a document with its value exactly on the lower exclusive boundary', () => {
      dsl.register('index', 'collection', {
        range: {
          foo: {
            gt: 42,
            lt: 110,
          },
        },
      });

      should(dsl.test('index', 'collection', {foo: 42}))
        .be.an.Array().and.be.empty();
    });

    it('should not match a document with its value exactly on the upper exclusive boundary', () => {
      dsl.register('index', 'collection', {
        range: {
          foo: {
            gt: 42,
            lt: 110,
          },
        },
      });

      should(dsl.test('index', 'collection', {foo: 110}))
        .be.an.Array().and.be.empty();
    });

    it('should match a document with only a lower boundary range', () => {
      const subscription = dsl.register('index', 'collection', {
        range: {
          foo: {gt: -10},
        },
      });

      should(dsl.test('index', 'collection', {foo: -5})).eql([subscription.id]);
    });

    it('should match a document with only an upper boundary range', () => {
      const subscription = dsl.register('index', 'collection', {
        range: {
          foo: {lt: -10},
        },
      });

      should(dsl.test('index', 'collection', {foo: -105})).eql([subscription.id]);
    });

    it('should return an empty array if the document does not contain the registered field', () => {
      dsl.register('index', 'collection', {range: {foo: {lt: -10}}});

      should(dsl.test('index', 'collection', {bar: -105}))
        .be.an.Array().and.be.empty();
    });

    it('should return an empty array if the document searched field is not a number', () => {
      dsl.register('index', 'collection', {range: {foo: {lt: -10}}});

      should(dsl.test('index', 'collection', {bar: 'baz'}))
        .be.an.Array().and.be.empty();
    });

    it('should consider 0 as a valid value', () => {
      const subscription = dsl.register('i', 'c', {range: {foo: {lt: 42}}});

      should(dsl.test('i', 'c', {foo: 0})).be.eql([subscription.id]);
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const subscription = dsl.register('index', 'collection', {
        range: {
          foo: {
            gte: 42,
            lte: 110,
          },
        },
      });

      dsl.remove(subscription.id);

      should(dsl.storage.foPairs._cache).be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const sub1 = dsl.register('index', 'collection', {
        range: {
          foo: {
            gt: 42,
            lt: 110,
          },
        },
      });

      const sub2 = dsl.register('index', 'collection', {
        and: [
          {range: {foo: {gt: 42, lt: 110}}},
          {range: {foo: {lt: 50}}},
        ],
      });

      const storage = foPairs.get('index', 'collection', 'range');
      const multiSubfilter = Array.from(filters.get(sub1.id).subfilters)[0];

      should(storage.fields.get('foo').conditions.size).eql(2);

      dsl.remove(sub2.id);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').conditions.size).eql(1);

      const rangeInfo = Array
        .from(storage.fields.get('foo').conditions.values())[0];

      should(rangeInfo.subfilters).match(new Set([multiSubfilter]));
      should(rangeInfo.low).approximately(42, 1e-9);
      should(rangeInfo.high).approximately(110, 1e-9);
    });

    it('should remove a field from the list if its last subfilter is removed', () => {
      const sub1 = dsl.register('index', 'collection', {
        range: {
          bar: {
            gt: 42,
            lt: 110,
          },
        },
      });

      const sub2 = dsl.register('index', 'collection', {
        range: {
          foo: {
            gte: 42,
            lte: 110,
          },
        },
      });

      const multiSubfilter = Array.from(filters.get(sub2.id).subfilters)[0];
      const operand = foPairs.get('index', 'collection', 'range');

      should(operand.fields).have.keys('bar', 'foo');

      dsl.remove(sub1.id);
      const storage = foPairs.get('index', 'collection', 'range');

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
