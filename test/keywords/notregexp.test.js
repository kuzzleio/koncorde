const should = require('should/as-function');
const sinon = require('sinon');

const FieldOperand = require('../../lib/engine/objects/fieldOperand');
const RegexpCondition = require('../../lib/engine/objects/regexpCondition');
const Koncorde = require('../../');

describe('Koncorde.keyword.notregexp', () => {
  let koncorde;
  let engine;

  beforeEach(() => {
    koncorde = new Koncorde();
    engine = koncorde.engines.get(null);
  });

  describe('#storage', () => {
    it('should invoke regexp storage function', () => {
      const spy = sinon.spy(engine.storeOperand, 'regexp');

      const id = koncorde.register({
        not: {
          regexp: {
            foo: {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      const storage = engine.foPairs.get('notregexp');
      const condition = new RegexpCondition(
        { regExpEngine: 're2' },
        '^\\w{2}oba\\w$',
        Array.from(engine.filters.get(id).subfilters)[0],
        'i');

      should(spy.called).be.true();

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(condition.stringValue))
        .eql(condition);
    });

    it('should invoke regexp storage function (js engine)', () => {
      koncorde = new Koncorde({ regExpEngine: 'js' });
      engine = koncorde.engines.get(null);

      const spy = sinon.spy(engine.storeOperand, 'regexp');

      const id = koncorde.register({
        not: {
          regexp: {
            foo: {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      const storage = engine.foPairs.get('notregexp');
      const condition = new RegexpCondition(
        { regExpEngine: 'js' },
        '^\\w{2}oba\\w$',
        Array.from(engine.filters.get(id).subfilters)[0],
        'i');

      should(spy.called).be.true();

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(condition.stringValue))
        .eql(condition);
    });
  });

  describe('#matching', () => {
    it('should not match a document if its registered field matches the regexp', () => {
      koncorde.register({
        not: {
          regexp: {
            foo: {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      should(koncorde.test({ foo: 'foobar' })).be.an.Array().and.be.empty();
    });

    it('should match a document if its registered field does not match the regexp', () => {
      const id = koncorde.register({
        not: {
          regexp: {
            foo: {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      const result = koncorde.test({ foo: 'bar' });

      should(result).eql([id]);
    });

    it('should match if the document does not contain the registered field', () => {
      koncorde.register({
        not: {
          regexp: {
            foo: {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      should(koncorde.test({ bar: 'qux' })).be.an.Array().and.have.length(1);
    });

    it('should match a document with the subscribed nested keyword', () => {
      const id = koncorde.register({
        not: {
          regexp: {
            'foo.bar.baz': {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      const result = koncorde.test({ foo: { bar: { baz: 'bar' } } });

      should(result).eql([id]);
    });
  });

  describe('#removal', () => {
    it('should invoke regexp removal function', () => {
      const spy = sinon.spy(engine.removeOperand, 'regexp');

      const id = koncorde.register({
        not: {
          regexp: {
            foo: {
              value: '^\\w{2}oba\\w$',
              flags: 'i',
            },
          },
        },
      });

      koncorde.remove(id);

      should(spy.called).be.true();
      should(engine.foPairs).be.empty();
    });
  });
});
