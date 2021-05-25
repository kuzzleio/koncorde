const should = require('should/as-function');

const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const DSL = require('../../');

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
      should(() => dsl.validate({equals: ['foo', 'bar']}))
        .throw('"equals" must be a non-empty object');
    });

    it('should reject filters with more than 1 field', () => {
      should(() => dsl.validate({equals: {foo: 'foo', bar: 'bar'}}))
        .throw('"equals" can contain only one attribute');
    });

    it('should reject filters with array argument', () => {
      should(() => dsl.validate({equals: {foo: ['bar']}}))
        .throw('"foo" in "equals" must be either a string, a number, a boolean or null');
    });

    it('should validate filters with number argument', () => {
      should(() => dsl.validate({equals: {foo: 42}})).not.throw();
    });

    it('should reject filters with object argument', () => {
      should(() => dsl.validate({equals: {foo: {}}}))
        .throw('"foo" in "equals" must be either a string, a number, a boolean or null');
    });

    it('should reject filters with undefined argument', () => {
      should(() => dsl.validate({equals: {foo: undefined}}))
        .throw('"foo" in "equals" must be either a string, a number, a boolean or null');
    });

    it('should validate filters with null argument', () => {
      should(() => dsl.validate({equals: {foo: null}})).not.throw();
    });

    it('should validate filters with boolean argument', () => {
      should(() => dsl.validate({equals: {foo: true}})).not.throw();
    });

    it('should validate filters with a string argument', () => {
      should(() => dsl.validate({equals: {foo: 'bar'}})).not.throw();
    });

    it('should validate filters with an empty string argument', () => {
      should(() => dsl.validate({equals: {foo: ''}})).not.throw();
    });
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      should(dsl.transformer.standardizer.standardize({equals: {foo: 'bar'}}))
        .match({equals: {foo: 'bar'}});
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      const subscription = dsl.register('index', 'collection', {
        equals: { foo: 'bar' },
      });
      const subfilter = getSubfilter(subscription.id);
      const storage = dsl.storage.foPairs.get('index', 'collection', 'equals');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo'))
        .instanceOf(Map)
        .have.value('bar', new Set([subfilter]));
    });

    it('should store multiple conditions on the same field correctly', () => {
      let subscription = dsl.register('index', 'collection', {
        equals: {foo: 'bar'},
      });

      const barSubfilter = getSubfilter(subscription.id);

      subscription = dsl.register('index', 'collection', {equals: {foo: 'qux'}});

      const quxSubfilter = getSubfilter(subscription.id);
      const equals = dsl.storage.foPairs.get('index', 'collection', 'equals');

      should(equals).be.an.instanceof(FieldOperand);
      should(equals.fields.get('foo'))
        .have.value('bar', new Set([barSubfilter]));
      should(equals.fields.get('foo'))
        .have.value('qux', new Set([quxSubfilter]));
    });

    it('should store multiple subfilters on the same condition correctly', () => {
      let subscription = dsl.register('index', 'collection', {
        equals: {foo: 'bar'},
      });
      const barSubfilter = getSubfilter(subscription.id);

      subscription = dsl.register('index', 'collection', {
        and: [
          { equals: { baz: 'qux' } },
          { equals: { foo: 'bar' } }
        ]
      });

      const multiSubfilter = getSubfilter(subscription.id);
      const equals = dsl.storage.foPairs.get('index', 'collection', 'equals');

      should(equals).be.an.instanceof(FieldOperand);
      should(equals.fields.get('foo'))
        .have.value('bar', new Set([barSubfilter, multiSubfilter]));
      should(equals.fields.get('baz'))
        .have.value('qux', new Set([multiSubfilter]));
    });
  });

  describe('#matching', () => {
    it('should match a document with the subscribed keyword', () => {
      const subscription = dsl.register('index', 'collection', {
        equals: {foo: 'bar'},
      });
      const result = dsl.test('index', 'collection', {foo: 'bar'});

      should(result).be.an.Array().and.not.empty();
      should(result[0]).be.eql(subscription.id);
    });

    it('should match a document on its provided id', () => {
      const subscription = dsl.register('index', 'collection', {
        equals: {_id: 'foo'},
      });
      const result = dsl.test('index', 'collection', {foo: 'bar'}, 'foo');

      should(result).be.an.Array().and.not.empty();
      should(result[0]).be.eql(subscription.id);
    });

    it('should not match if the document contains the field with another value', () => {
      dsl.register('index', 'collection', {equals: {foo: 'bar'}});

      should(dsl.test('index', 'collection', {foo: 'qux'}))
        .be.an.Array()
        .and.be.empty();
    });

    it('should not match if the document contains another field with the registered value', () => {
      dsl.register('index', 'collection', {equals: {foo: 'bar'}});
      should(dsl.test('index', 'collection', {qux: 'bar'}))
        .be.an.Array()
        .and.be.empty();
    });

    // see https://github.com/kuzzleio/koncorde/issues/13
    it('should skip the matching if the document tested property is not of the same type than the known values', () => {
      dsl.register('index', 'collection', {equals: {foo: 'bar'}});

      should(dsl.test('index', 'collection', {foo: ['bar']}))
        .be.an.Array().and.empty();

      should(dsl.test('index', 'collection', {foo: {bar: true}}))
        .be.an.Array().and.empty();
    });

    it('should match a document with the subscribed nested keyword', () => {
      const subscription = dsl.register('index', 'collection', {
        equals: {'foo.bar.baz': 'qux'},
      });
      const result = dsl.test('index', 'collection', {foo: {bar: {baz: 'qux'}}});

      should(result).be.an.Array().and.not.empty();
      should(result[0]).be.eql(subscription.id);
    });

    it('should not match if the document is in another index', () => {
      dsl.register('index', 'collection', {equals: {foo: 'bar'}});
      should(dsl.test('foobar', 'collection', {foo: 'qux'}))
        .be.an.Array().and.empty();
    });

    it('should not match if the document is in another collection', () => {
      dsl.register('index', 'collection', {equals: {foo: 'bar'}});
      should(dsl.test('index', 'foobar', {foo: 'qux'}))
        .be.an.Array().and.empty();
    });

    it('should match 0 equality', () => {
      dsl.register('i', 'c', {equals: {a: 0}});
      should(dsl.test('i', 'c', {a: 0})).be.an.Array().length(1);
    });

    it('should match false equality', () => {
      dsl.register('i', 'c', {equals: {a: false}});
      should(dsl.test('i', 'c', {a: false})).be.an.Array().length(1);
    });

    it('should match null equality', () => {
      dsl.register('i', 'c', {equals: {a: null}});
      should(dsl.test('i', 'c', {a: null})).be.an.Array().length(1);
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const subscription = dsl.register('index', 'collection', {
        equals: {foo: 'bar'},
      });

      dsl.remove(subscription.id);

      should(dsl.storage.foPairs._cache).be.an.Object().and.be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const sub1 = dsl.register('index', 'collection', {
        equals: {foo: 'bar'},
      });

      const sub2 = dsl.register('index', 'collection', {
        and: [
          {equals: {baz: 'qux'}},
          {equals: {foo: 'bar'}},
        ],
      });

      dsl.remove(sub1.id);

      const equals = dsl.storage.foPairs.get('index', 'collection', 'equals');
      const multiSubfilter = getSubfilter(sub2.id);

      should(equals).be.an.instanceof(FieldOperand);
      should(equals.fields.get('foo'))
        .have.value('bar', new Set([multiSubfilter]));
      should(equals.fields.get('baz'))
        .have.value('qux', new Set([multiSubfilter]));
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      const sub1 = dsl.register('index', 'collection', {equals: {foo: 'bar'}});
      const equals = dsl.storage.foPairs.get('index', 'collection', 'equals');
      const barSubfilter = getSubfilter(sub1.id);

      const sub2 = dsl.register('index', 'collection', {equals: {foo: 'qux'}});

      should(equals.fields.get('foo').get('bar')).eql(new Set([barSubfilter]));

      should(equals.fields.get('foo').get('qux'))
        .eql(new Set([getSubfilter(sub2.id)]));

      dsl.remove(sub2.id);

      should(equals).be.an.instanceof(FieldOperand);
      should(equals.fields.get('foo'))
        .have.value('bar', new Set([barSubfilter]))
        .not.have.key('qux');
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      const sub1 = dsl.register('index', 'collection', {equals: {foo: 'bar'}});
      const barSubfilter = getSubfilter(sub1.id);

      const sub2 = dsl.register('index', 'collection', {equals: {baz: 'qux'}});
      const equals = dsl.storage.foPairs.get('index', 'collection', 'equals');

      should(equals.fields.get('baz'))
        .have.value('qux', new Set([getSubfilter(sub2.id)]));

      dsl.remove(sub2.id);

      should(equals).be.an.instanceof(FieldOperand);

      should(equals.fields.get('foo'))
        .have.value('bar', new Set([barSubfilter]));

      should(equals.fields).not.have.key('baz');
    });

    it('should remove a single collection if other collections are registered', () => {
      dsl.register('index', 'collection', {equals: {foo: 'bar'}});
      const sub = dsl.register('index', 'collection2', {equals: {foo: 'bar'}});

      should(dsl.storage.foPairs.has('index', 'collection')).be.true();
      should(dsl.storage.foPairs.has('index', 'collection2')).be.true();

      dsl.remove(sub.id);

      should(dsl.storage.foPairs.has('index', 'collection')).be.true();
      should(dsl.storage.foPairs.has('index', 'collection2')).be.false();
    });
  });
});
