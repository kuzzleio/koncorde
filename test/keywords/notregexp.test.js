const should = require('should/as-function');
const sinon = require('sinon');

const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const RegexpCondition = require('../../lib/storage/objects/regexpCondition');
const DSL = require('../../');

describe('DSL.keyword.notregexp', () => {
  let dsl;
  let filters;
  let foPairs;

  beforeEach(() => {
    dsl = new DSL();
    filters = dsl.storage.filters;
    foPairs = dsl.storage.foPairs;
  });

  describe('#storage', () => {
    it('should invoke regexp storage function', () => {
      const spy = sinon.spy(dsl.storage.storeOperand, 'regexp');

      const subscription = dsl.register('index', 'collection', {
        not: {
          regexp: {
            foo: {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      const storage = foPairs.get('index', 'collection', 'notregexp');
      const condition = new RegexpCondition(
        { regExpEngine: 're2' },
        '^\\w{2}oba\\w$',
        Array.from(filters.get(subscription.id).subfilters)[0],
        'i');

      should(spy.called).be.true();

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(condition.stringValue))
        .eql(condition);
    });

    it('should invoke regexp storage function (js engine)', () => {
      dsl = new DSL({ regExpEngine: 'js' });
      const spy = sinon.spy(dsl.storage.storeOperand, 'regexp');

      const subscription = dsl.register('index', 'collection', {
        not: {
          regexp: {
            foo: {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      const storage = dsl.storage.foPairs.get('index', 'collection', 'notregexp');
      const condition = new RegexpCondition(
        { regExpEngine: 'js' },
        '^\\w{2}oba\\w$',
        Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
        'i');

      should(spy.called).be.true();

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(condition.stringValue))
        .eql(condition);
    });
  });

  describe('#matching', () => {
    it('should not match a document if its registered field matches the regexp', () => {
      dsl.register('index', 'collection', {
        not: {
          regexp: {
            foo: {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      should(dsl.test('index', 'collection', {foo: 'foobar'}))
        .be.an.Array().and.be.empty();
    });

    it('should match a document if its registered field does not match the regexp', () => {
      const subscription = dsl.register('index', 'collection', {
        not: {
          regexp: {
            foo: {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      const result = dsl.test('index', 'collection', {foo: 'bar'});

      should(result).eql([subscription.id]);
    });

    it('should match if the document does not contain the registered field', () => {
      dsl.register('index', 'collection', {
        not: {
          regexp: {
            foo: {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      should(dsl.test('index', 'collection', {bar: 'qux'}))
        .be.an.Array()
        .and.have.length(1);
    });

    it('should match a document with the subscribed nested keyword', () => {
      const subscription = dsl.register('index', 'collection', {
        not: {
          regexp: {
            'foo.bar.baz': {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      const result = dsl.test('index', 'collection', {foo: {bar: {baz: 'bar'}}});

      should(result).eql([subscription.id]);
    });

    it('should not match if the document is in another index', () => {
      dsl.register('index', 'collection', {
        not: {
          regexp: {
            foo: {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      should(dsl.test('foobar', 'collection', {foo: 'qux'}))
        .be.an.Array().and.empty();
    });

    it('should not match if the document is in another collection', () => {
      dsl.register('index', 'collection', {
        not: {
          regexp: {
            foo: {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      should(dsl.test('index', 'foobar', {foo: 'qux'}))
        .be.an.Array().and.empty();
    });
  });

  describe('#removal', () => {
    it('should invoke regexp removal function', () => {
      const spy = sinon.spy(dsl.storage.removeOperand, 'regexp');

      const subscription = dsl.register('index', 'collection', {
        not: {
          regexp: {
            foo: {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      dsl.remove(subscription.id);

      should(spy.called).be.true();
      should(dsl.storage.foPairs._cache).be.empty();
    });
  });
});
