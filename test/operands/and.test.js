const should = require('should/as-function');
const Koncorde = require('../../');

describe('koncorde.operands.and', () => {
  let koncorde;

  beforeEach(() => {
    koncorde = new Koncorde();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      should(() => koncorde.validate({and: []}))
        .throw('Attribute "and" cannot be empty');
    });

    it('should reject non-array content', () => {
      should(() => koncorde.validate({and: {foo: 'bar'}}))
        .throw('Attribute "and" must be an array');
    });

    it('should reject if one of the content is not an object', () => {
      const filter = {
        and: [
          {equals: {foo: 'bar'}},
          [ {exists: {field: 'foo'}} ],
        ],
      };

      should(() => koncorde.validate(filter))
        .throw('"and" operand can only contain non-empty objects');
    });

    it('should reject if one of the content object does not refer to a valid keyword', () => {
      const filter = {
        and: [
          {equals: {foo: 'bar'}},
          {foo: 'bar'},
        ],
      };

      should(() => koncorde.validate(filter))
        .throw('Unknown DSL keyword: foo');
    });

    it('should reject if one of the content object is not a well-formed keyword', () => {
      const filter = {
        and: [
          {equals: {foo: 'bar'}},
          {exists: {foo: 'bar'}},
        ],
      };

      should(() => koncorde.validate(filter))
        .throw('"exists" requires the following attribute: field');
    });

    it('should validate a well-formed "and" operand', () => {
      const filter = {
        and: [
          {equals: {foo: 'bar'}},
          {exists: {field: 'bar'}},
        ],
      };

      should(koncorde.validate(filter)).not.throw();
    });
  });

  describe('#matching', () => {
    it('should match a document with multiple AND conditions', () => {
      const filters = {
        and: [
          { equals: { name: 'bar' } },
          { exists: 'skills.languages["javascript"]' },
        ]
      };

      const id = koncorde.register(filters);
      const result = koncorde.test({
        name: 'bar',
        skills: { languages: ['c++', 'javascript', 'c#'] },
      });

      should(result).eql([id]);
    });

    it('should not match if the document misses at least 1 condition', () => {
      koncorde.register({
        and: [
          { equals: { name: 'bar' } },
          { exists: 'skills.languages["javascript"]' },
        ]
      });

      const result = koncorde.test({
        name: 'qux',
        skills: { languages: ['ruby', 'php', 'elm', 'javascript'] },
      });

      should(result).be.an.Array().and.empty();
    });
  });

  describe('#removal', () => {
    it('should destroy all associated keywords to an AND operand', () => {
      const id = koncorde.register({
        and: [
          { equals: { foo: 'bar' } },
          { missing: { field: 'bar' } },
          { range: { baz: {lt: 42} } },
        ],
      });

      koncorde.register({ exists: { field: 'foo' } });

      koncorde.remove(id);

      should(koncorde.storage.foPairs.get('exists')).be.an.Object();
      should(koncorde.storage.foPairs.get('equals')).be.undefined();
      should(koncorde.storage.foPairs.get('notexists')).be.undefined();
      should(koncorde.storage.foPairs.get('range')).be.undefined();
    });
  });
});
