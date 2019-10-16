'use strict';

const
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  Koncorde = require('../../');

describe('koncorde.operands.and', () => {
  let koncorde;

  beforeEach(() => {
    koncorde = new Koncorde();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(koncorde.validate({and: []})).be.rejectedWith(BadRequestError);
    });

    it('should reject non-array content', () => {
      return should(koncorde.validate({and: {foo: 'bar'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject if one of the content is not an object', () => {
      return should(koncorde.validate({and: [{equals: {foo: 'bar'}}, [{exists: {field: 'foo'}}]]})).be.rejectedWith(BadRequestError);
    });

    it('should reject if one of the content object does not refer to a valid keyword', () => {
      return should(koncorde.validate({and: [{equals: {foo: 'bar'}}, {foo: 'bar'}]})).be.rejectedWith(BadRequestError);
    });

    it('should reject if one of the content object is not a well-formed keyword', () => {
      return should(koncorde.validate({and: [{equals: {foo: 'bar'}}, {exists: {foo: 'bar'}}]})).be.rejectedWith(BadRequestError);
    });

    it('should validate a well-formed "and" operand', () => {
      return should(koncorde.validate({and: [{equals: {foo: 'bar'}}, {exists: {field: 'bar'}}]})).be.fulfilledWith(true);
    });
  });

  describe('#matching', () => {
    it('should match a document with multiple AND conditions', () => {
      const filters = {
        and: [
          { equals: { name: 'bar' } },
          { exists: 'skills.languages["javascript"]' },
          // { range: { baz: { lt: 42 } } }
        ]
      };

      return koncorde.register('index', 'collection', filters)
        .then(subscription => {
          const result = koncorde.test(
            'index',
            'collection',
            {
              name: 'bar',
              // baz: 13,
              skills: { languages: ['c++', 'javascript', 'c#'] }
            });

          should(result).eql([subscription.id]);
        });
    });

    it('should not match if the document misses at least 1 condition', () => {
      const filters = {
        and: [
          { equals: { name: 'bar' } },
          { exists: 'skills.languages["javascript"]' },
          // { range: { baz: { lt: 42 } } }
        ]
      };

      return koncorde.register('index', 'collection', filters)
        .then(() => {
          const result = koncorde.test(
            'index',
            'collection',
            {
              name: 'qux',
              // baz: 13,
              skills: { languages: ['ruby', 'php', 'elm', 'javascript'] }
            });

          should(result).be.an.Array().and.empty();
        });
    });
  });

  describe('#removal', () => {
    it('should destroy all associated keywords to an AND operand', () => {
      let id;

      return koncorde.register('index', 'collection', {and: [{equals: {foo: 'bar'}}, {missing: {field: 'bar'}}, {range: {baz: {lt: 42}}}]})
        .then(subscription => {
          id = subscription.id;
          return koncorde.register('index', 'collection', {exists: {field: 'foo'}});
        })
        .then(() => koncorde.remove(id))
        .then(() => {
          should(koncorde.storage.foPairs.get('index', 'collection', 'exists')).be.an.Object();
          should(koncorde.storage.foPairs.get('index', 'collection', 'equals')).be.undefined();
          should(koncorde.storage.foPairs.get('index', 'collection', 'notexists')).be.undefined();
          should(koncorde.storage.foPairs.get('index', 'collection', 'range')).be.undefined();
        });
    });
  });
});
