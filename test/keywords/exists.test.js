const should = require('should/as-function');

const FieldOperand = require('../../lib/engine/objects/fieldOperand');
const Koncorde = require('../../');
const NormalizedExists = require('../../lib/transform/normalizedExists');

describe('Koncorde.keyword.exists', () => {
  let koncorde;
  let engine;

  beforeEach(() => {
    koncorde = new Koncorde();
    engine = koncorde.engines.get(null);
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => koncorde.validate({exists: {}}))
        .throw('"exists" must be a non-empty object');
    });

    it('should reject filters with more than 1 field', () => {
      should(() => koncorde.validate({exists: {field: 'foo', bar: 'bar'}}))
        .throw('"exists" can contain only one attribute');
    });

    it('should reject filters in object-form without a "field" attribute', () => {
      should(() => koncorde.validate({exists: {foo: 'bar'}}))
        .throw('"exists" requires the following attribute: field');
    });

    it('should reject filters with array argument', () => {
      should(() => koncorde.validate({exists: {field: ['bar']}}))
        .throw('Attribute "field" in "exists" must be a string');
    });

    it('should reject filters with number argument', () => {
      should(() => koncorde.validate({exists: {field: 42}}))
        .throw('Attribute "field" in "exists" must be a string');
    });

    it('should reject filters with object argument', () => {
      should(() => koncorde.validate({exists: {field: {}}}))
        .throw('Attribute "field" in "exists" must be a string');
    });

    it('should reject filters with undefined argument', () => {
      should(() => koncorde.validate({exists: {field: undefined}}))
        .throw('"exists" requires the following attribute: field');
    });

    it('should reject filters with null argument', () => {
      should(() => koncorde.validate({exists: {field: null}}))
        .throw('Attribute "field" in "exists" must be a string');
    });

    it('should reject filters with boolean argument', () => {
      should(() => koncorde.validate({exists: {field: true}}))
        .throw('Attribute "field" in "exists" must be a string');
    });

    it('should validate filters with a string argument', () => {
      should(() => koncorde.validate({exists: {field: 'bar'}}))
        .not.throw();
    });

    it('should reject filters with an empty string argument', () => {
      should(() => koncorde.validate({exists: {field: ''}}))
        .throw('exists: cannot test empty field name');
    });

    it('should validate filters written in simplified form', () => {
      should(() => koncorde.validate({exists: 'bar'})).not.throw();
    });

    it('should reject a filter in simplified form with an empty value', () => {
      should(() => koncorde.validate({exists: ''}))
        .throw('exists: cannot test empty field name');
    });

    it('should reject incorrectly formatted array search filters', () => {
      should(() => koncorde.validate({exists: 'foo[\'bar\']'}))
        .throw('[exists] Invalid array value "\'bar\'"');
    });
  });

  describe('#standardization', () => {
    it('should return the normalized filter (from old syntax)', () => {
      const result = koncorde.transformer.standardizer.standardize({
        exists: { field: 'bar' },
      });

      should(result).match({exists: new NormalizedExists('bar', false, null)});
    });

    it('should return the normalized filter (from simplified syntax)', () => {
      const result = koncorde.transformer.standardizer.standardize({
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
        const result = koncorde.transformer.standardizer.standardize({
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
      const res = koncorde.transformer.standardizer.standardize({
        exists: 'foo[bar'
      });

      should(res).match({
        exists: new NormalizedExists('foo[bar', false, null)
      });
    });

    it('should properly interpret escaped brackets as an object field name', () => {
      const res = koncorde.transformer.standardizer.standardize({
        exists: 'foo.ba\\[true\\]'
      });

      should(res).match({
        exists: new NormalizedExists('foo.ba[true]', false, null)
      });
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      const id = koncorde.register({ exists: 'foo' });
      const subfilter = engine.filters.get(id).subfilters;
      const storage = engine.foPairs.get('exists');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').subfilters).eql(subfilter);
      should(storage.fields.get('foo').values).instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(0);
    });

    it('should store multiple subfilters on the same condition correctly', () => {
      const id1 = koncorde.register({ exists: 'foo' });
      const id2 = koncorde.register({
        and: [
          { equals: { bar: 'qux' } },
          { exists: 'foo' }
        ]
      });

      const storage = engine.foPairs.get('exists');

      should(storage).be.instanceOf(FieldOperand);

      const barSubfilter = Array.from(engine.filters.get(id1).subfilters)[0];
      const quxSubfilter = Array.from(engine.filters.get(id2).subfilters)[0];
      should(storage.fields.get('foo').subfilters)
        .eql(new Set([barSubfilter, quxSubfilter]));

      should(storage.fields.get('foo').values).instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(0);
    });

    it('should store a single array search correctly', () => {
      const id = koncorde.register({ exists: 'foo["bar"]' });
      const subfilter = Array.from(engine.filters.get(id).subfilters)[0];
      const storage = engine.foPairs.get('exists');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').subfilters.size).eql(0);
      should(storage.fields.get('foo').values).instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(1);
      should(storage.fields.get('foo').values.get('bar'))
        .eql(new Set([subfilter]));
    });

    it('should multiple array searches correctly', () => {
      const id1 = koncorde.register({ exists: 'foo["bar"]' });
      const id2 = koncorde.register({
        and: [
          { exists: 'qux["bar"]' },
          { exists: 'foo["bar"]' },
        ]
      });

      const storage = engine.foPairs.get('exists');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').subfilters.size).eql(0);
      should(storage.fields.get('foo').values).instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(1);

      const barSubfilter = Array.from(engine.filters.get(id1).subfilters)[0];
      const quxSubfilter = Array.from(engine.filters.get(id2).subfilters)[0];
      should(storage.fields.get('foo').values.get('bar'))
        .eql(new Set([barSubfilter, quxSubfilter]));

      should(storage.fields.get('qux').values.get('bar'))
        .eql(new Set([quxSubfilter]));
    });
  });

  describe('#matching', () => {
    it('should match a document with the subscribed field', () => {
      const id = koncorde.register({ exists: 'foo' });
      const result = koncorde.test({ foo: 'bar' });

      should(result).eql([id]);
    });

    it('should not match if the document does not contain the searched field', () => {
      koncorde.register({ exists: 'foo' });
      should(koncorde.test({ fooo: 'baz' })).be.an.Array().and.empty();
    });

    it('should match a document with the subscribed nested keyword', () => {
      const id = koncorde.register({ exists: 'foo.bar.baz' });
      const result = koncorde.test({ foo: { bar: { baz: 'qux' } } });

      should(result).eql([id]);
    });

    it('should match if a searched value is in the document', () => {
      const values = [ '"foo"', '"bar"', 3.14, 42, false, true, null ];
      const ids = values.map(v => koncorde.register({ exists: `foo[${v}]` }));

      for (let i = 0; i < ids.length; i++) {
        const expected = typeof values[i] === 'string'
          ? values[i].replace(/"/g, '')
          : values[i];

        should(koncorde.test({ foo: ['hello', expected, 'world'] })).eql([ids[i]]);
      }
    });

    it('should not match if an array search is not of the right type', () => {
      const id = koncorde.register({ exists: 'foo[null]' });
      should(koncorde.test({ foo: [ null ] })).eql([id]);
      should(koncorde.test({ foo: [ 'null' ] })).empty();
    });

    it('(see issue #24) should handle duplicates gracefully', () => {
      koncorde.register({
        and: [
          { equals: { name: 'Leo' } },
          { exists: 'skills.languages["javascript"]' },
        ],
      });

      const matches = koncorde.test({
        name: 'Bob',
        skills: {
          languages: ['pascal', 'javascript', 'python', 'javascript'],
        },
      });

      should(matches).be.an.Array().and.empty();
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const id = koncorde.register({ exists: 'foo' });

      koncorde.remove(id);
      should(engine.foPairs).be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const id1 = koncorde.register({ exists: 'foo' });
      const id2 = koncorde.register({
        and: [
          { equals: { foo: 'qux' } },
          { exists: { field: 'foo' } },
        ],
      });


      koncorde.remove(id1);

      const storage = engine.foPairs.get('exists');

      should(storage).be.instanceOf(FieldOperand);

      const multiSubfilter = Array.from(engine.filters.get(id2).subfilters)[0];
      should(storage.fields.get('foo').subfilters)
        .match(new Set([multiSubfilter]));

      should(storage.fields.get('foo').values).be.instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(0);
    });

    it('should remove a single subfilter from a multi-filter array condition', () => {
      const id1 = koncorde.register({ exists: 'foo["bar"]' });
      const id2 = koncorde.register({
        and: [
          {equals: {foo: 'qux'}},
          {exists: {field: 'foo["bar"]'}},
        ],
      });

      const storage = engine.foPairs.get('exists');
      const singleSubfilter = Array.from(engine.filters.get(id1).subfilters)[0];
      const multiSubfilter = Array.from(engine.filters.get(id2).subfilters)[0];
      should(storage.fields.get('foo').values.get('bar'))
        .match(new Set([singleSubfilter, multiSubfilter]));

      should(storage.fields.get('foo').subfilters.size).eql(0);

      koncorde.remove(id1);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').subfilters.size).eql(0);
      should(storage.fields.get('foo').values.get('bar'))
        .match(new Set([multiSubfilter]));
    });

    it('should remove a field from the list if its last subfilter is removed', () => {
      const id1 = koncorde.register({ exists: 'foo' });
      const id2 = koncorde.register({ exists: 'bar' });
      const storage = engine.foPairs.get('exists');

      should(storage.fields).have.keys('foo', 'bar');

      koncorde.remove(id2);

      should(storage).be.instanceOf(FieldOperand);

      const fooSubfilter = Array.from(engine.filters.get(id1).subfilters)[0];
      should(storage.fields.get('foo').subfilters)
        .match(new Set([fooSubfilter]));

      should(storage.fields.get('foo').values).be.instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(0);
      should(storage.fields.get('bar')).be.undefined();
    });

    it('should remove a field from the list if its last array search value is removed', () => {
      const id1 = koncorde.register({ exists: 'foo' });
      const id2 = koncorde.register({ exists: 'bar["foo"]' });

      koncorde.remove(id2);

      const storage = engine.foPairs.get('exists');

      should(storage).be.instanceOf(FieldOperand);

      const fooSubfilter = Array.from(engine.filters.get(id1).subfilters)[0];
      should(storage.fields.get('foo').subfilters).match(new Set([fooSubfilter]));

      should(storage.fields.get('foo').values).be.instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(0);
      should(storage.fields.get('bar')).be.undefined();
    });

    it('should keep a field if a field existence test remains', () => {
      const id1 = koncorde.register({ exists: 'foo' });
      const id2 = koncorde.register({ exists: 'foo["bar"]' });

      koncorde.remove(id2);

      const storage = engine.foPairs.get('exists');

      should(storage).be.instanceOf(FieldOperand);

      const fooSubfilter = Array.from(engine.filters.get(id1).subfilters)[0];
      should(storage.fields.get('foo').subfilters).match(new Set([fooSubfilter]));

      should(storage.fields.get('foo').values).be.instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(0);
    });

    it('should keep a field if an array search test remains', () => {
      const id1 = koncorde.register({ exists: 'foo["bar"]' });
      const id2 = koncorde.register({ exists: 'foo' });

      koncorde.remove(id2);

      const storage = engine.foPairs.get('exists');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').subfilters.size).eql(0);
      should(storage.fields.get('foo').values).be.instanceOf(Map);
      should(storage.fields.get('foo').values.size).eql(1);

      const fooSubfilter = Array.from(engine.filters.get(id1).subfilters)[0];
      should(storage.fields.get('foo').values.get('bar'))
        .eql(new Set([fooSubfilter]));
    });
  });
});
