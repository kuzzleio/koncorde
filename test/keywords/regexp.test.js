const should = require('should/as-function');
const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const RegexpCondition = require('../../lib/storage/objects/regexpCondition');
const DSL = require('../../');

describe('DSL.keyword.regexp', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(dsl.validate({regexp: {}}))
        .be.rejectedWith('"regexp" must be a non-empty object');
    });

    it('should reject filters with more than 1 field', () => {
      const filter = {foo: {value: 'foo'}, bar: {value: 'foo'}};

      return should(dsl.validate({regexp: filter}))
        .be.rejectedWith('"regexp" can contain only one attribute');
    });

    it('should reject filters with an empty field object', () => {
      return should(dsl.validate({regexp: {foo: {}}}))
        .be.rejectedWith('regexp.foo must be either a string or a non-empty object');
    });

    it('should reject filters with other fields defined other than the accepted ones', () => {
      const filter = {foo: {value: 'foo', flags: 'ig', bar: 'qux'}};

      return should(dsl.validate({regexp: filter}))
        .be.rejectedWith('Keyword "regexp" can only contain the following attributes: flags, value');
    });

    it('should reject filters if the "value" attribute is not defined', () => {
      return should(dsl.validate({regexp: {foo: {flags: 'ig'}}}))
        .be.rejectedWith('"regexp" requires the following attribute: value');
    });

    it('should reject filters with a non-string "flags" attribute', () => {
      return should(dsl.validate({regexp: {foo: {value: 'foo', flags: 42}}}))
        .be.rejectedWith('Attribute "flags" in "regexp" must be a string');
    });

    it('should reject filters with an invalid regular expression value', () => {
      return should(dsl.validate({regexp: {foo: {value: 'foo(', flags: 'i'}}}))
        .be.rejectedWith(/^Cannot parse regexp expression/);
    });

    it('should reject filters with invalid flags (js engine only)', () => {
      dsl = new DSL({ regExpEngine: 'js' });
      return should(dsl.validate({
        regexp: {
          foo: {
            value: 'a',
            flags: 'INVALID'
          }
        }
      }))
        .be.rejectedWith(/^Cannot parse regexp expression/);
    });

    it('should validate a well-formed regular expression filter w/ flags', () => {
      return dsl.normalize('foo', 'bar', {regexp: {foo: {value: 'foo', flags: 'i'}}})
        .then(res => {
          should(res.normalized).match([[{regexp:{foo:{flags:'i',value:'foo'}}}]]);
        });
    });

    it('should validate a well-formed regular expression filter without flags', () => {
      return dsl.normalize('foo', 'bar', {regexp: {foo: {value: 'foo'}}})
        .then(res => {
          should(res.normalized).match([[{regexp:{foo:{flags:undefined,value:'foo'}}}]]);
        });
    });

    it('should accept a simplified form', () => {
      return dsl.normalize('foo', 'bar', {regexp: {foo: '^bar'}})
        .then(res => {
          should(res.normalized).match([[{regexp:{foo:{flags:undefined,value:'^bar'}}}]]);
        });
    });

    it('should reject an invalid simple form regex', () => {
      return should(dsl.validate({
        regexp: {
          foo: '++'
        }
      }))
        .be.rejectedWith(/^Cannot parse regexp expression/);
    });
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      const filter = {regexp: {foo: {value: 'foo', flags: 'i'}}};
      should(dsl.transformer.standardizer.standardize(filter)).match(filter);
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      return dsl.register('index', 'collection', {regexp: {foo: {value: 'foo', flags: 'i'}}})
        .then(subscription => {
          const
            storage = dsl.storage.foPairs.get('index', 'collection', 'regexp'),
            regexp = new RegexpCondition(
              { regExpEngine: 're2' },
              'foo',
              Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
              'i'
            );

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').get(regexp.stringValue)).eql(regexp);
        });
    });

    it('should store multiple conditions on the same field correctly', () => {
      let cond1;

      return dsl.register('index', 'collection', {regexp: {foo: {value: 'foo', flags: 'i'}}})
        .then(subscription => {
          cond1 = new RegexpCondition(
            { regExpEngine: 're2' },
            'foo',
            Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            'i'
          );

          return dsl.register('index', 'collection', {regexp: {foo: {value: 'bar'}}});
        })
        .then(subscription => {
          const
            storage = dsl.storage.foPairs.get('index', 'collection', 'regexp'),
            cond2 = new RegexpCondition(
              { regExpEngine: 're2' },
              'bar',
              Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0]
            );

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').size).eql(2);
          should(storage.fields.get('foo').get(cond1.stringValue)).eql(cond1);
          should(storage.fields.get('foo').get(cond2.stringValue)).eql(cond2);
        });
    });

    it('should store multiple subfilters on the same condition correctly', () => {
      let cond;
      const filter = {regexp: {foo: {value: 'foo', flags: 'i'}}};

      return dsl.register('index', 'collection', filter)
        .then(subscription => {
          cond = new RegexpCondition(
            { regExpEngine: 're2' },
            'foo',
            Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            'i'
          );

          return dsl.register('index', 'collection', {and: [filter, {equals: {foo: 'bar'}}]});
        })
        .then(subscription => {
          const storage = dsl.storage.foPairs.get('index', 'collection', 'regexp');
          cond.subfilters.add(Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0]);

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').size).eql(1);
          should(storage.fields.get('foo').get(cond.stringValue)).eql(cond);
        });
    });
  });

  describe('#matching', () => {
    it('should match a document if its registered field matches the regexp', () => {
      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(subscription => {
          should(dsl.test('index', 'collection', {foo: 'FOOBAR'})).eql([subscription.id]);
        });
    });

    it('should not match a document if its registered field does not match the regexp', () => {
      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: 'Saskatchewan'})).be.an.Array().and.be.empty();
        });
    });

    it('should not match if the document does not contain the registered field', () => {
      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(() => {
          should(dsl.test('index', 'collection', {bar: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should match a document with the subscribed nested keyword', () => {
      return dsl.register('index', 'collection', {regexp: {'foo.bar.baz': {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(subscription => {
          const result = dsl.test('index', 'collection', {foo: {bar: {baz: 'FOOBAR'}}});

          should(result).eql([subscription.id]);
        });
    });

    it('should not match if the document is in another index', () => {
      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(() => {
          should(dsl.test('foobar', 'collection', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should not match if the document is in another collection', () => {
      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(() => {
          should(dsl.test('index', 'foobar', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(subscription => dsl.remove(subscription.id))
        .then(() => should(dsl.storage.foPairs._cache).be.empty());
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const filter = {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}};
      let
        idToRemove,
        cond;

      return dsl.register('index', 'collection', filter)
        .then(subscription => {
          idToRemove = subscription.id;

          return dsl.register('index', 'collection', {and: [filter, {equals: {foo: 'bar'}}]});
        })
        .then(subscription => {
          cond = new RegexpCondition(
            { regExpEngine: 're2' },
            '^\\w{2}oba\\w$',
            Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            'i'
          );

          return dsl.remove(idToRemove);
        })
        .then(() => {
          const storage = dsl.storage.foPairs.get('index', 'collection', 'regexp');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').get(cond.stringValue)).match(cond);
        });
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      let
        idToRemove,
        cond;

      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(subscription => {
          cond = new RegexpCondition(
            { regExpEngine: 're2' },
            '^\\w{2}oba\\w$',
            Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            'i'
          );

          return dsl.register('index', 'collection', {regexp: {foo: {value: '^$'}}});
        })
        .then(subscription => {
          idToRemove = subscription.id;
          return dsl.remove(idToRemove);
        })
        .then(() => {
          const storage = dsl.storage.foPairs.get('index', 'collection', 'regexp');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').get(cond.stringValue)).match(cond);
          should(storage.fields.get('foo').size).eql(1);
        });
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      let cond;

      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(subscription => {
          cond = new RegexpCondition(
            { regExpEngine: 're2' },
            '^\\w{2}oba\\w$',
            Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            'i'
          );

          return dsl.register('index', 'collection', {regexp: {bar: {value: '^\\w{2}oba\\w$', flags: 'i'}}});
        })
        .then(subscription => {
          const operand = dsl.storage.foPairs.get('index', 'collection', 'regexp');
          should (operand.fields).have.keys('foo', 'bar');

          return dsl.remove(subscription.id);
        })
        .then(() => {
          const storage = dsl.storage.foPairs.get('index', 'collection', 'regexp');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').get(cond.stringValue)).match(cond);
          should(storage.fields.get('bar')).be.undefined();
        });
    });
  });
});
