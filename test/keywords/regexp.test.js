const should = require('should/as-function');
const FieldOperand = require('../../lib/engine/objects/fieldOperand');
const { RegExpCondition } = require('../../lib/engine/objects/regexpCondition');
const { Koncorde } = require('../../');

describe('Koncorde.keyword.regexp', () => {
  let koncorde;
  let engine;

  beforeEach(() => {
    koncorde = new Koncorde();
    engine = koncorde.engines.get(null);
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => koncorde.validate({regexp: {}}))
        .throw({
          keyword: 'regexp',
          message: '"regexp": expected object to have exactly 1 property, got 0',
          path: 'regexp',
        });
    });

    it('should reject filters with more than 1 field', () => {
      const filter = {foo: {value: 'foo'}, bar: {value: 'foo'}};

      should(() => koncorde.validate({regexp: filter}))
        .throw({
          keyword: 'regexp',
          message: '"regexp": expected object to have exactly 1 property, got 2',
          path: 'regexp',
        });
    });

    it('should reject filters with an empty field object', () => {
      should(() => koncorde.validate({regexp: {foo: {}}}))
        .throw({
          keyword: 'regexp',
          message: '"regexp.foo": must be a non-empty object',
          path: 'regexp.foo',
        });
    });

    it('should reject filters with other fields defined other than the accepted ones', () => {
      const filter = {foo: {value: 'foo', flags: 'ig', bar: 'qux'}};

      should(() => koncorde.validate({regexp: filter}))
        .throw({
          keyword: 'regexp',
          message: '"regexp.foo": "bar" is not an allowed attribute (allowed: flags,value)',
          path: 'regexp.foo',
        });
    });

    it('should reject filters if the "value" attribute is not defined', () => {
      should(() => koncorde.validate({regexp: {foo: {flags: 'ig'}}}))
        .throw({
          keyword: 'regexp',
          message: '"regexp.foo": the property "value" is missing',
          path: 'regexp.foo',
        });
    });

    it('should reject filters with a non-string "flags" attribute', () => {
      should(() => koncorde.validate({regexp: {foo: {value: 'foo', flags: 42}}}))
        .throw({
          keyword: 'regexp',
          message: '"regexp.foo.flags": must be a string',
          path: 'regexp.foo.flags',
        });
    });

    it('should reject filters with an invalid regular expression value', () => {
      should(() => koncorde.validate({regexp: {foo: {value: 'foo(', flags: 'i'}}}))
        .throw({
          keyword: 'regexp',
          message: /^"regexp.foo": cannot parse regexp expression/,
          path: 'regexp.foo',
        });
    });

    it('should reject filters with invalid flags (js engine only)', () => {
      koncorde = new Koncorde({ regExpEngine: 'js' });

      should(() => koncorde.validate({
        regexp: {
          foo: {
            value: 'a',
            flags: 'INVALID'
          }
        }
      }))
        .throw({
          keyword: 'regexp',
          message: /^"regexp.foo": cannot parse regexp expression/,
          path: 'regexp.foo',
        });
    });

    it('should validate a well-formed regular expression filter w/ flags', () => {
      const normalized = koncorde.normalize({
        regexp: {
          foo: {
            value: 'foo',
            flags: 'i',
          },
        },
      });

      should(normalized.filter).match([
        [
          {
            regexp: {
              foo: {
                flags:'i',
                value:'foo',
              },
            },
          },
        ],
      ]);
    });

    it('should validate a well-formed regular expression filter without flags', () => {
      const normalized = koncorde.normalize({
        regexp: {
          foo: {
            value: 'foo',
          },
        },
      });

      should(normalized.filter).match([
        [
          {
            regexp: {
              foo: {
                flags: undefined,
                value: 'foo',
              },
            },
          },
        ],
      ]);
    });

    it('should accept a simplified form', () => {
      const normalized = koncorde.normalize({ regexp: { foo: '^bar' } });

      should(normalized.filter).match([
        [
          {
            regexp: {
              foo: {
                flags: undefined,
                value: '^bar',
              },
            },
          },
        ],
      ]);
    });

    it('should reject an invalid simple form regex', () => {
      should(() => koncorde.validate({ regexp: { foo: '++' } }))
        .throw({
          keyword: 'regexp',
          message: /^"regexp.foo": cannot parse regexp expression/,
          path: 'regexp.foo',
        });
    });
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      const filter = {
        regexp: {
          foo: {
            value: 'foo',
            flags: 'i',
          },
        },
      };

      should(koncorde.transformer.standardizer.standardize(filter)).match(filter);
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      const id = koncorde.register({
        regexp: {
          foo: {
            value: 'foo',
            flags: 'i',
          },
        },
      });

      const storage = engine.foPairs.get('regexp');
      const regexp = new RegExpCondition(
        { regExpEngine: 're2' },
        'foo',
        Array.from(engine.filters.get(id).subfilters)[0],
        'i');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(regexp.stringValue)).eql(regexp);
    });

    it('should store multiple conditions on the same field correctly', () => {
      const id1 = koncorde.register({
        regexp: {
          foo: {
            value: 'foo',
            flags: 'i',
          },
        },
      });

      const id2 = koncorde.register({
        regexp: {
          foo: {
            value: 'bar',
          },
        },
      });

      const cond1 = new RegExpCondition(
        { regExpEngine: 're2' },
        'foo',
        Array.from(engine.filters.get(id1).subfilters)[0],
        'i');
      const storage = engine.foPairs.get('regexp');
      const cond2 = new RegExpCondition(
        { regExpEngine: 're2' },
        'bar',
        Array.from(engine.filters.get(id2).subfilters)[0]);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').size).eql(2);
      should(storage.fields.get('foo').get(cond1.stringValue)).eql(cond1);
      should(storage.fields.get('foo').get(cond2.stringValue)).eql(cond2);
    });

    it('should store multiple subfilters on the same condition correctly', () => {
      const filter = {
        regexp: {
          foo: {
            value: 'foo',
            flags: 'i',
          },
        },
      };


      const id1 = koncorde.register(filter);
      const id2 = koncorde.register({
        and: [
          filter,
          { equals: { foo: 'bar' } },
        ],
      });

      const storage = engine.foPairs.get('regexp');
      const cond = new RegExpCondition(
        { regExpEngine: 're2' },
        'foo',
        Array.from(engine.filters.get(id1).subfilters)[0],
        'i');

      cond.subfilters.add(Array.from(engine.filters.get(id2).subfilters)[0]);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').size).eql(1);
      should(storage.fields.get('foo').get(cond.stringValue)).eql(cond);
    });
  });

  describe('#matching', () => {
    it('should match a document if its registered field matches the regexp', () => {
      const id = koncorde.register({
        regexp: {
          foo: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      should(koncorde.test({ foo: 'FOOBAR' })).eql([id]);
    });

    it('should not match a document if its registered field does not match the regexp', () => {
      koncorde.register({
        regexp: {
          foo: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      should(koncorde.test({ foo: 'Saskatchewan' })).be.an.Array().and.be.empty();
    });

    it('should not match if the document does not contain the registered field', () => {
      koncorde.register({
        regexp: {
          foo: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      should(koncorde.test({ bar: 'qux' })).be.an.Array().and.empty();
    });

    it('should match a document with the subscribed nested keyword', () => {
      const id = koncorde.register({
        regexp: {
          'foo.bar.baz': {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      const result = koncorde.test({
        foo: {
          bar: {baz: 'FOOBAR'},
        },
      });

      should(result).eql([id]);
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const id = koncorde.register({
        regexp: {
          foo: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      koncorde.remove(id);

      should(engine.foPairs).be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const filter = {
        regexp: {
          foo: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      };

      const id1 = koncorde.register(filter);
      const id2 = koncorde.register({
        and: [
          filter,
          {equals: {foo: 'bar'}},
        ],
      });

      const cond = new RegExpCondition(
        { regExpEngine: 're2' },
        '^\\w{2}oba\\w$',
        Array.from(engine.filters.get(id2).subfilters)[0],
        'i');

      koncorde.remove(id1);

      const storage = engine.foPairs.get('regexp');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(cond.stringValue)).match(cond);
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      const id1 = koncorde.register({
        regexp: {
          foo: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      const id2 = koncorde.register({ regexp: { foo: { value: '^$' } } });

      const cond = new RegExpCondition(
        { regExpEngine: 're2' },
        '^\\w{2}oba\\w$',
        Array.from(engine.filters.get(id1).subfilters)[0],
        'i');

      koncorde.remove(id2);

      const storage = engine.foPairs.get('regexp');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(cond.stringValue)).match(cond);
      should(storage.fields.get('foo').size).eql(1);
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      const id1 = koncorde.register({
        regexp: {
          foo: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      const id2 = koncorde.register({
        regexp: {
          bar: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      const cond = new RegExpCondition(
        { regExpEngine: 're2' },
        '^\\w{2}oba\\w$',
        Array.from(engine.filters.get(id1).subfilters)[0],
        'i');

      const storage = engine.foPairs.get('regexp');

      should (storage.fields).have.keys('foo', 'bar');

      koncorde.remove(id2);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(cond.stringValue)).match(cond);
      should(storage.fields.get('bar')).be.undefined();
    });
  });
});
