const should = require('should/as-function');
const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const RegexpCondition = require('../../lib/storage/objects/regexpCondition');
const DSL = require('../../');

describe('DSL.keyword.regexp', () => {
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
      should(() => dsl.validate({regexp: {}}))
        .throw('"regexp" must be a non-empty object');
    });

    it('should reject filters with more than 1 field', () => {
      const filter = {foo: {value: 'foo'}, bar: {value: 'foo'}};

      should(() => dsl.validate({regexp: filter}))
        .throw('"regexp" can contain only one attribute');
    });

    it('should reject filters with an empty field object', () => {
      should(() => dsl.validate({regexp: {foo: {}}}))
        .throw('regexp.foo must be either a string or a non-empty object');
    });

    it('should reject filters with other fields defined other than the accepted ones', () => {
      const filter = {foo: {value: 'foo', flags: 'ig', bar: 'qux'}};

      should(() => dsl.validate({regexp: filter}))
        .throw('Keyword "regexp" can only contain the following attributes: flags, value');
    });

    it('should reject filters if the "value" attribute is not defined', () => {
      should(() => dsl.validate({regexp: {foo: {flags: 'ig'}}}))
        .throw('"regexp" requires the following attribute: value');
    });

    it('should reject filters with a non-string "flags" attribute', () => {
      should(() => dsl.validate({regexp: {foo: {value: 'foo', flags: 42}}}))
        .throw('Attribute "flags" in "regexp" must be a string');
    });

    it('should reject filters with an invalid regular expression value', () => {
      should(() => dsl.validate({regexp: {foo: {value: 'foo(', flags: 'i'}}}))
        .throw(/^Cannot parse regexp expression/);
    });

    it('should reject filters with invalid flags (js engine only)', () => {
      dsl = new DSL({ regExpEngine: 'js' });

      should(() => dsl.validate({
        regexp: {
          foo: {
            value: 'a',
            flags: 'INVALID'
          }
        }
      }))
        .throw(/^Cannot parse regexp expression/);
    });

    it('should validate a well-formed regular expression filter w/ flags', () => {
      const res = dsl.normalize({
        regexp: {
          foo: {
            value: 'foo',
            flags: 'i',
          },
        },
      });

      should(res.normalized).match([[{regexp:{foo:{flags:'i',value:'foo'}}}]]);
    });

    it('should validate a well-formed regular expression filter without flags', () => {
      const res = dsl.normalize({ regexp: { foo: { value: 'foo' } } });

      should(res.normalized).match([
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
      const res = dsl.normalize({ regexp: { foo: '^bar' } });

      should(res.normalized).match([
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
      should(() => dsl.validate({ regexp: { foo: '++' } }))
        .throw(/^Cannot parse regexp expression/);
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

      should(dsl.transformer.standardizer.standardize(filter)).match(filter);
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      const id = dsl.register({
        regexp: {
          foo: {
            value: 'foo',
            flags: 'i',
          },
        },
      });

      const storage = foPairs.get('regexp');
      const regexp = new RegexpCondition(
        { regExpEngine: 're2' },
        'foo',
        Array.from(filters.get(id).subfilters)[0],
        'i');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(regexp.stringValue)).eql(regexp);
    });

    it('should store multiple conditions on the same field correctly', () => {
      const id1 = dsl.register({
        regexp: {
          foo: {
            value: 'foo',
            flags: 'i',
          },
        },
      });

      const id2 = dsl.register({
        regexp: {
          foo: {
            value: 'bar',
          },
        },
      });

      const cond1 = new RegexpCondition(
        { regExpEngine: 're2' },
        'foo',
        Array.from(filters.get(id1).subfilters)[0],
        'i');
      const storage = foPairs.get('regexp');
      const cond2 = new RegexpCondition(
        { regExpEngine: 're2' },
        'bar',
        Array.from(filters.get(id2).subfilters)[0]);

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


      const id1 = dsl.register(filter);
      const id2 = dsl.register({
        and: [
          filter,
          { equals: { foo: 'bar' } },
        ],
      });

      const storage = foPairs.get('regexp');
      const cond = new RegexpCondition(
        { regExpEngine: 're2' },
        'foo',
        Array.from(filters.get(id1).subfilters)[0],
        'i');

      cond.subfilters.add(Array.from(filters.get(id2).subfilters)[0]);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').size).eql(1);
      should(storage.fields.get('foo').get(cond.stringValue)).eql(cond);
    });
  });

  describe('#matching', () => {
    it('should match a document if its registered field matches the regexp', () => {
      const id = dsl.register({
        regexp: {
          foo: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      should(dsl.test({ foo: 'FOOBAR' })).eql([id]);
    });

    it('should not match a document if its registered field does not match the regexp', () => {
      dsl.register({
        regexp: {
          foo: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      should(dsl.test({ foo: 'Saskatchewan' })).be.an.Array().and.be.empty();
    });

    it('should not match if the document does not contain the registered field', () => {
      dsl.register({
        regexp: {
          foo: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      should(dsl.test({ bar: 'qux' })).be.an.Array().and.empty();
    });

    it('should match a document with the subscribed nested keyword', () => {
      const id = dsl.register({
        regexp: {
          'foo.bar.baz': {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      const result = dsl.test({
        foo: {
          bar: {baz: 'FOOBAR'},
        },
      });

      should(result).eql([id]);
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const id = dsl.register({
        regexp: {
          foo: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      dsl.remove(id);

      should(foPairs).be.empty();
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

      const id1 = dsl.register(filter);
      const id2 = dsl.register({
        and: [
          filter,
          {equals: {foo: 'bar'}},
        ],
      });

      const cond = new RegexpCondition(
        { regExpEngine: 're2' },
        '^\\w{2}oba\\w$',
        Array.from(filters.get(id2).subfilters)[0],
        'i');

      dsl.remove(id1);

      const storage = foPairs.get('regexp');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(cond.stringValue)).match(cond);
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      const id1 = dsl.register({
        regexp: {
          foo: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      const id2 = dsl.register({ regexp: { foo: { value: '^$' } } });

      const cond = new RegexpCondition(
        { regExpEngine: 're2' },
        '^\\w{2}oba\\w$',
        Array.from(filters.get(id1).subfilters)[0],
        'i');

      dsl.remove(id2);

      const storage = foPairs.get('regexp');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(cond.stringValue)).match(cond);
      should(storage.fields.get('foo').size).eql(1);
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      const id1 = dsl.register({
        regexp: {
          foo: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      const id2 = dsl.register({
        regexp: {
          bar: {
            value: '^\\w{2}oba\\w$',
            flags: 'i',
          },
        },
      });

      const cond = new RegexpCondition(
        { regExpEngine: 're2' },
        '^\\w{2}oba\\w$',
        Array.from(filters.get(id1).subfilters)[0],
        'i');

      const storage = foPairs.get('regexp');

      should (storage.fields).have.keys('foo', 'bar');

      dsl.remove(id2);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(cond.stringValue)).match(cond);
      should(storage.fields.get('bar')).be.undefined();
    });
  });
});
