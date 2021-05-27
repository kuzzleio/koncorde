const should = require('should/as-function');
const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const DSL = require('../../');

describe('DSL.keyword.everything', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should validate an empty filter', () => {
      should(() => dsl.validate({})).not.throw();
    });

    it('should validate a null filter', () => {
      should(() => dsl.validate(null)).not.throw();
    });

    it('should validate an undefined filter', () => {
      should(() => dsl.validate(null)).not.throw();
    });
  });

  describe('#storage', () => {
    it('should register an empty filter correctly', () => {
      const sub = dsl.register('index', 'collection', {});
      const storeEntry = dsl.storage.foPairs.get(
        'index',
        'collection',
        'everything');

      should(storeEntry).be.instanceof(FieldOperand);
      should(storeEntry.fields).have.value(
        'all',
        Array.from(dsl.storage.filters.get(sub.id).subfilters));
    });
  });

  describe('#matching', () => {
    it('should match as long as a document is in the right index and collection', () => {
      const sub = dsl.register('index', 'collection', {});
      const result = dsl.test('index', 'collection', {foo: 'bar'});

      should(result).be.an.Array().and.not.empty();
      should(result[0]).be.eql(sub.id);
    });

    it('should not match if the document is in another index', () => {
      dsl.register('index', 'collection', {});
      should(dsl.test('foobar', 'collection', {foo: 'bar'}))
        .be.an.Array()
        .be.empty();
    });

    it('should not match if the document is in another collection', () => {
      dsl.register('index', 'collection', {});
      should(dsl.test('index', 'foobar', {foo: 'bar'}))
        .be.an.Array()
        .be.empty();
    });
  });

  describe('#removal', () => {
    it('should remove the whole f-o pair on delete', () => {
      const sub = dsl.register('index', 'collection', {});
      dsl.remove(sub.id);

      should(dsl.storage.foPairs._cache).and.be.empty();
    });
  });
});
