require('reify');

const should = require('should/as-function');
const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const DSL = require('../../');

describe('DSL.keyword.notequals', () => {
  let dsl;
  let filters;
  let foPairs;

  beforeEach(() => {
    dsl = new DSL();
    filters = dsl.storage.filters;
    foPairs = dsl.storage.foPairs;
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      const result = dsl.transformer.standardizer.standardize({
        not: {
          equals: {
            foo: 'bar',
          },
        },
      });

      should(result).match({not: {equals: {foo: 'bar'}}});
    });
  });

  describe('#matching', () => {
    it('should not match a document with the subscribed keyword', () => {
      dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}});

      should(dsl.test('index', 'collection', {foo: 'bar'}))
        .be.an.Array().and.be.empty();
    });

    it('should match if the document contains the field with another value', () => {
      const sub = dsl.register('index', 'collection', {
        not: {
          equals: {
            foo: 'bar',
          },
        },
      });

      const result = dsl.test('index', 'collection', {foo: 'qux'});

      should(result).eql([sub.id]);
    });

    it('should match if the document do not contain the registered field', () => {
      const sub = dsl.register('index', 'collection', {
        not: {
          equals: {
            foo: 'bar',
          },
        },
      });

      const result = dsl.test('index', 'collection', {qux: 'bar'});

      should(result).eql([sub.id]);
    });

    it('should match a document with the subscribed nested keyword', () => {
      const sub = dsl.register('index', 'collection', {
        not: {
          equals: {
            'foo.bar.baz': 'qux',
          },
        },
      });

      const result = dsl.test('index', 'collection', {
        foo: {
          bar: {
            baz: 'foobar',
          },
        },
      });

      should(result).be.eql([sub.id]);
    });

    it('should not match if the document is in another index', () => {
      dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}});

      should(dsl.test('foobar', 'collection', {foo: 'qux'}))
        .be.an.Array().and.empty();
    });

    it('should not match if the document is in another collection', () => {
      dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}});

      should(dsl.test('index', 'foobar', {foo: 'qux'}))
        .be.an.Array().and.empty();
    });

    it('should match even if another field was hit before', () => {
      dsl.register('i', 'c', {not: {equals: {a: 'Jennifer Cardini'}}});
      dsl.register('i', 'c', {not: {equals: {b: 'Shonky'}}});

      should(dsl.test('i', 'c', {a: 'Jennifer Cardini'}))
        .be.an.Array()
        .length(1);
    });

    it('should match 0 equality', () => {
      dsl.register('i', 'c', {not: {equals: {a: 0}}});

      should(dsl.test('i', 'c', {a: 0}))
        .be.an.Array()
        .be.empty();
    });

    it('should match false equality', () => {
      dsl.register('i', 'c', {not: {equals: {a: false}}});

      should(dsl.test('i', 'c', {a: false}))
        .be.an.Array()
        .be.empty();
    });

    it('should match null equality', () => {
      dsl.register('i', 'c', {not: {equals: {a: null}}});

      should(dsl.test('i', 'c', {a: null}))
        .be.an.Array()
        .be.empty();
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const sub = dsl.register('index', 'collection', {
        not: {
          equals: {
            foo: 'bar',
          },
        },
      });

      dsl.remove(sub.id);

      should(foPairs._cache).be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const sub1 = dsl.register('index', 'collection', {
        not: {
          equals: {
            foo: 'bar',
          },
        },
      });

      const sub2 = dsl.register('index', 'collection', {
        and: [
          {not: {equals: {foo: 'qux'}}},
          {not: {equals: {foo: 'bar'}}},
        ],
      });

      const subfilter = Array.from(filters.get(sub2.id).subfilters)[0];

      dsl.remove(sub1.id);

      const storage = foPairs.get('index', 'collection', 'notequals');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo')).instanceOf(Map);
      should(storage.fields.get('foo').size).eql(2);
      should(storage.fields.get('foo').get('bar')).eql(new Set([subfilter]));
      should(storage.fields.get('foo').get('qux')).eql(new Set([subfilter]));
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      const sub1 = dsl.register('index', 'collection', {
        not: {
          equals: {
            foo: 'bar',
          },
        },
      });

      const sub2 = dsl.register('index', 'collection', {
        and: [
          {not: {equals: {foo: 'qux'}}},
          {not: {equals: {foo: 'bar'}}},
        ],
      });


      dsl.remove(sub2.id);

      const storage = foPairs.get('index', 'collection', 'notequals');
      const barSubfilter = Array.from(filters.get(sub1.id).subfilters)[0];

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get('bar')).match(new Set([barSubfilter]));
      should(storage.fields.get('foo').get('qux')).undefined();
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      const sub1 = dsl.register('index', 'collection', {
        not: {
          equals: {
            foo: 'bar',
          },
        },
      });

      const sub2 = dsl.register('index', 'collection', {
        not: {
          equals: {
            baz: 'qux',
          },
        },
      });

      const barSubfilter = Array.from(filters.get(sub1.id).subfilters)[0];
      const operand = foPairs.get('index', 'collection', 'notequals');

      should(operand.fields).have.keys('foo', 'baz');

      dsl.remove(sub2.id);

      const storage = foPairs.get('index', 'collection', 'notequals');
      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get('bar')).match(new Set([barSubfilter]));
      should(storage.fields.get('baz')).be.undefined();
    });
  });
});
