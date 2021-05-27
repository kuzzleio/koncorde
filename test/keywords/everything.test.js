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
      const id = dsl.register({});
      const storeEntry = dsl.storage.foPairs.get('everything');

      should(storeEntry).be.instanceof(FieldOperand);
      should(storeEntry.fields).have.value(
        'all',
        Array.from(dsl.storage.filters.get(id).subfilters));
    });
  });

  describe('#matching', () => {
    it('should match any document', () => {
      const id = dsl.register({});
      const result = dsl.test({ foo: 'bar' });

      should(result).be.an.Array().and.not.empty();
      should(result[0]).be.eql(id);
    });
  });

  describe('#removal', () => {
    it('should remove the whole f-o pair on delete', () => {
      const id = dsl.register({});
      dsl.remove(id);

      should(dsl.storage.foPairs).and.be.empty();
    });
  });
});
