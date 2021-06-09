const should = require('should/as-function');
const FieldOperand = require('../../lib/engine/objects/fieldOperand');
const Koncorde = require('../../');

describe('Koncorde.keyword.everything', () => {
  let koncorde;
  let engine;

  beforeEach(() => {
    koncorde = new Koncorde();
    engine = koncorde.engines.get(null);
  });

  describe('#validation', () => {
    it('should validate an empty filter', () => {
      should(() => koncorde.validate({})).not.throw();
    });

    it('should validate a null filter', () => {
      should(() => koncorde.validate(null)).not.throw();
    });

    it('should validate an undefined filter', () => {
      should(() => koncorde.validate(null)).not.throw();
    });
  });

  describe('#storage', () => {
    it('should register an empty filter correctly', () => {
      const id = koncorde.register({});
      const storeEntry = engine.foPairs.get('everything');

      should(storeEntry).be.instanceof(FieldOperand);
      should(storeEntry.fields).have.value(
        'all',
        Array.from(engine.filters.get(id).subfilters));
    });
  });

  describe('#matching', () => {
    it('should match any document', () => {
      const id = koncorde.register({});
      const result = koncorde.test({ foo: 'bar' });

      should(result).be.an.Array().and.not.empty();
      should(result[0]).be.eql(id);
    });
  });

  describe('#removal', () => {
    it('should remove the whole f-o pair on delete', () => {
      const id = koncorde.register({});
      koncorde.remove(id);

      should(engine.foPairs).and.be.empty();
    });
  });
});
