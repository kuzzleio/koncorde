const should = require('should/as-function');

const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const Koncorde = require('../../');
const NormalizedExists = require('../../lib/transform/normalizedExists');

describe('Koncorde.keyword.exists', () => {
  let dsl;
  let filters;

  beforeEach(() => {
    dsl = new Koncorde();
    filters = dsl.storage.filters;
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => dsl.validate({exists: {}}))
        .throw('"exists" must be a non-empty object');
    });

    it('should reject filters with more than 1 field', () => {
      should(() => dsl.validate({exists: {field: 'foo', bar: 'bar'}}))
        .throw('"exists" can contain only one attribute');
    });

    it('should reject filters in object-form without a "field" attribute', () => {
      should(() => dsl.validate({exists: {foo: 'bar'}}))
        .throw('"exists" requires the following attribute: field');
    });

    it('should reject filters with array argument', () => {
      should(() => dsl.validate({exists: {field: ['bar']}}))
        .throw('Attribute "field" in "exists" must be a string');
    });

    it('should reject filters with number argument', () => {
      should(() => dsl.validate({exists: {field: 42}}))
        .throw('Attribute "field" in "exists" must be a string');
    });

    it('should reject filters with object argument', () => {
      should(() => dsl.validate({exists: {field: {}}}))
        .throw('Attribute "field" in "exists" must be a string');
    });

    it('should reject filters with undefined argument', () => {
      should(() => dsl.validate({exists: {field: undefined}}))
        .throw('"exists" requires the following attribute: field');
    });

    it('should reject filters with null argument', () => {
      should(() => dsl.validate({exists: {field: null}}))
        .throw('Attribute "field" in "exists" must be a string');
    });

    it('should reject filters with boolean argument', () => {
      should(() => dsl.validate({exists: {field: true}}))
        .throw('Attribute "field" in "exists" must be a string');
    });

    it('should validate filters with a string argument', () => {
      should(() => dsl.validate({exists: {field: 'bar'}}))
        .not.throw();
    });

    it('should reject filters with an empty string argument', () => {
      should(() => dsl.validate({exists: {field: ''}}))
        .throw('exists: cannot test empty field name');
    });

    it('should validate filters written in simplified form', () => {
      should(() => dsl.validate({exists: 'bar'})).not.throw();
    });

    it('should reject a filter in simplified form with an empty value', () => {
      should(() => dsl.validate({exists: ''}))
        .throw('exists: cannot test empty field name');
    });

    it('should reject incorrectly formatted array search filters', () => {
      should(() => dsl.validate({exists: 'foo[\'bar\']'}))
        .throw('[exists] Invalid array value "\'bar\'"');
    });
  });

  describe('#standardization', () => {
    it('should return the normalized filter (from old syntax)', () => {
      const result = dsl.transformer.standardizer.standardize({
        exists: { field: 'bar' },
      });

      should(result).match({exists: new NormalizedExists('bar', false, null)});
    });

    it('should return the normalized filter (from simplified syntax)', () => {
      const result = dsl.transformer.standardizer.standardize({
        exists: 'bar',
      });
      should(result).match({exists: new NormalizedExists('bar', false, null)});
    });

    it('should parse and normalize array values', () => {
      const values = [
        42,
        3.14,
        true,
        false,
        null,
        '"foobar"',
        '"null"',
        '"true"',
        '"42"'
      ];

      for (const value of values) {
        const result = dsl.transformer.standardizer.standardize({
          exists: `foo.bar[${value}]`,
        });

        const expected = typeof value === 'string' ?
          value.replace(/"/g, '') :
          value;

        should(result.exists).instanceOf(NormalizedExists);
        should(result.exists.array).be.true();
        should(result.exists.path).eql('foo.bar');
        should(result.exists.value).eql(expected);
        should(typeof result.exists.value).eql(typeof value);
      }
    });

    it('should not interpret unclosed brackets as an array value', () => {
      const res = dsl.transformer.standardizer.standardize({
        exists: 'foo[bar'
      });

      should(res).match({
        exists: new NormalizedExists('foo[bar', false, null)
      });
    });

    it('should properly interpret escaped brackets as an object field name', () => {
      const res = dsl.transformer.standardizer.standardize({
        exists: 'foo.ba\\[true\\]'
      });

      should(res).match({
        exists: new NormalizedExists('foo.ba[true]', false, null)
      });
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      const sub = dsl.register('index', 'collection', {exists: 'foo'});
      const subfilter = dsl.storage.filters.get(sub.id).subfilters;
      const storage = dsl.storage.foPairs.get('index', 'collection', 'exists');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').subfilters).eql(subfilter);
      should(storage.fields.get('foo').values).instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(0);
    });

    it('should store multiple subfilters on the same condition correctly', () => {
      const sub1 = dsl.register('index', 'collection', {exists: 'foo'});
      const sub2 = dsl.register('index', 'collection', {
        and: [
          {equals: {bar: 'qux'}},
          {exists: 'foo'}
        ]
      });

      const storage = dsl.storage.foPairs.get('index', 'collection', 'exists');

      should(storage).be.instanceOf(FieldOperand);

      const barSubfilter = Array.from(filters.get(sub1.id).subfilters)[0];
      const quxSubfilter = Array.from(filters.get(sub2.id).subfilters)[0];
      should(storage.fields.get('foo').subfilters)
        .eql(new Set([barSubfilter, quxSubfilter]));

      should(storage.fields.get('foo').values).instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(0);
    });

    it('should store a single array search correctly', () => {
      const sub = dsl.register('index', 'collection', {exists: 'foo["bar"]'});
      const subfilter = Array.from(filters.get(sub.id).subfilters)[0];
      const storage = dsl.storage.foPairs.get('index', 'collection', 'exists');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').subfilters.size).eql(0);
      should(storage.fields.get('foo').values).instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(1);
      should(storage.fields.get('foo').values.get('bar'))
        .eql(new Set([subfilter]));
    });

    it('should multiple array searches correctly', () => {
      const sub1 = dsl.register('index', 'collection', {exists: 'foo["bar"]'});

      const sub2 = dsl.register('index', 'collection', {
        and: [
          {exists: 'qux["bar"]'},
          {exists: 'foo["bar"]'}
        ]
      });

      const storage = dsl.storage.foPairs.get('index', 'collection', 'exists');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').subfilters.size).eql(0);
      should(storage.fields.get('foo').values).instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(1);

      const barSubfilter = Array.from(filters.get(sub1.id).subfilters)[0];
      const quxSubfilter = Array.from(filters.get(sub2.id).subfilters)[0];
      should(storage.fields.get('foo').values.get('bar'))
        .eql(new Set([barSubfilter, quxSubfilter]));

      should(storage.fields.get('qux').values.get('bar'))
        .eql(new Set([quxSubfilter]));
    });
  });

  describe('#matching', () => {
    it('should match a document with the subscribed field', () => {
      const sub = dsl.register('index', 'collection', {exists: 'foo'});
      const result = dsl.test('index', 'collection', {foo: 'bar'});

      should(result).eql([sub.id]);
    });

    it('should not match if the document does not contain the searched field', () => {
      dsl.register('index', 'collection', {exists: 'foo'});
      should(dsl.test('index', 'collection', {fooo: 'baz'}))
        .be.an.Array().and.empty();
    });

    it('should match a document with the subscribed nested keyword', () => {
      const sub = dsl.register('index', 'collection', {exists: 'foo.bar.baz'});
      const result = dsl.test('index', 'collection', {foo: {bar: {baz: 'qux'}}});

      should(result).eql([sub.id]);
    });

    it('should not match if the document is in another index', () => {
      dsl.register('index', 'collection', {exists: 'foo'});
      should(dsl.test('foobar', 'collection', {foo: 'qux'}))
        .be.an.Array().and.empty();
    });

    it('should not match if the document is in another collection', () => {
      dsl.register('index', 'collection', {exists: 'foo'});
      should(dsl.test('index', 'foobar', {foo: 'qux'}))
        .be.an.Array().and.empty();
    });

    it('should match if a searched value is in the document', () => {
      const values = ['"foo"', '"bar"', 3.14, 42, false, true, null];
      const subscriptions = values
        .map(v => dsl.register('i', 'c', {exists: `foo[${v}]`}));

      for (let i = 0; i < subscriptions.length; i++) {
        const expected = typeof values[i] === 'string'
          ? values[i].replace(/"/g, '')
          : values[i];

        should(dsl.test('i', 'c', {foo: ['hello', expected, 'world']}))
          .eql([subscriptions[i].id]);
      }
    });

    it('should not match if an array search is not of the right type', () => {
      const sub = dsl.register('i', 'c', {exists: 'foo[null]'});
      should(dsl.test('i', 'c', {foo: [null]})).eql([sub.id]);
      should(dsl.test('i', 'c', {foo: ['null']})).empty();
    });

    it('(see issue #24) should handle duplicates gracefully', () => {
      dsl.register('index', 'collection', {
        and: [
          { equals: { name: 'Leo' } },
          { exists: 'skills.languages["javascript"]' },
        ],
      });

      const matches = dsl.test('index', 'collection', {
        name: 'Bob',
        skills: {
          languages: ['pascal', 'javascript', 'python', 'javascript']
        }
      });

      should(matches).be.an.Array().and.empty();
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const sub = dsl.register('index', 'collection', {exists: 'foo'});

      dsl.remove(sub.id);
      should(dsl.storage.foPairs._cache).be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const sub1 = dsl.register('index', 'collection', {exists: 'foo'});

      const sub2 = dsl.register('index', 'collection', {
        and: [
          {equals: {foo: 'qux'}},
          {exists: {field: 'foo'}},
        ],
      });


      dsl.remove(sub1.id);

      const storage = dsl.storage.foPairs.get('index', 'collection', 'exists');

      should(storage).be.instanceOf(FieldOperand);

      const multiSubfilter = Array.from(filters.get(sub2.id).subfilters)[0];
      should(storage.fields.get('foo').subfilters)
        .match(new Set([multiSubfilter]));

      should(storage.fields.get('foo').values).be.instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(0);
    });

    it('should remove a single subfilter from a multi-filter array condition', () => {
      const sub1 = dsl.register('index', 'collection', {exists: 'foo["bar"]'});
      const storage = dsl.storage.foPairs.get('index', 'collection', 'exists');

      const sub2 = dsl.register('index', 'collection', {
        and: [
          {equals: {foo: 'qux'}},
          {exists: {field: 'foo["bar"]'}},
        ],
      });

      const singleSubfilter = Array.from(filters.get(sub1.id).subfilters)[0];
      const multiSubfilter = Array.from(filters.get(sub2.id).subfilters)[0];
      should(storage.fields.get('foo').values.get('bar'))
        .match(new Set([singleSubfilter, multiSubfilter]));

      should(storage.fields.get('foo').subfilters.size).eql(0);

      dsl.remove(sub1.id);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').subfilters.size).eql(0);
      should(storage.fields.get('foo').values.get('bar'))
        .match(new Set([multiSubfilter]));
    });

    it('should remove a field from the list if its last subfilter is removed', () => {
      const sub1 = dsl.register('index', 'collection', {exists: 'foo'});
      const sub2 = dsl.register('index', 'collection', {exists: 'bar'});
      const operand = dsl.storage.foPairs.get('index', 'collection', 'exists');

      should(operand.fields).have.keys('foo', 'bar');
      dsl.remove(sub2.id);

      const storage = dsl.storage.foPairs.get('index', 'collection', 'exists');

      should(storage).be.instanceOf(FieldOperand);

      const fooSubfilter = Array.from(filters.get(sub1.id).subfilters)[0];
      should(storage.fields.get('foo').subfilters)
        .match(new Set([fooSubfilter]));

      should(storage.fields.get('foo').values).be.instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(0);
      should(storage.fields.get('bar')).be.undefined();
    });

    it('should remove a field from the list if its last array search value is removed', () => {
      const sub1 = dsl.register('index', 'collection', {exists: 'foo'});
      const sub2 = dsl.register('index', 'collection', {exists: 'bar["foo"]'});

      dsl.remove(sub2.id);

      const storage = dsl.storage.foPairs.get('index', 'collection', 'exists');

      should(storage).be.instanceOf(FieldOperand);

      const fooSubfilter = Array.from(filters.get(sub1.id).subfilters)[0];
      should(storage.fields.get('foo').subfilters).match(new Set([fooSubfilter]));

      should(storage.fields.get('foo').values).be.instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(0);
      should(storage.fields.get('bar')).be.undefined();
    });

    it('should keep a field if a field existence test remains', () => {
      const sub1 = dsl.register('index', 'collection', {exists: 'foo'});
      const sub2 = dsl.register('index', 'collection', {exists: 'foo["bar"]'});

      dsl.remove(sub2.id);

      const storage = dsl.storage.foPairs.get('index', 'collection', 'exists');

      should(storage).be.instanceOf(FieldOperand);

      const fooSubfilter = Array.from(filters.get(sub1.id).subfilters)[0];
      should(storage.fields.get('foo').subfilters).match(new Set([fooSubfilter]));

      should(storage.fields.get('foo').values).be.instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(0);
    });

    it('should keep a field if an array search test remains', () => {
      const sub1 = dsl.register('index', 'collection', {exists: 'foo["bar"]'});
      const sub2 = dsl.register('index', 'collection', {exists: 'foo'});

      dsl.remove(sub2.id);

      const storage = dsl.storage.foPairs.get('index', 'collection', 'exists');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').subfilters.size).eql(0);
      should(storage.fields.get('foo').values).be.instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(1);

      const fooSubfilter = Array.from(filters.get(sub1.id).subfilters)[0];
      should(storage.fields.get('foo').values.get('bar'))
        .eql(new Set([fooSubfilter]));
    });
  });
});
