const should = require('should/as-function');

const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const DSL = require('../../');

describe('DSL.keyword.nothing', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#storage', () => {
    it('should register in the store', () => {
      const id = dsl.register({ nothing: 'anything' });

      const storeEntry = dsl.storage.foPairs.get('nothing');

      should(storeEntry).be.instanceof(FieldOperand);
      should(storeEntry.fields.get('all'))
        .eql([Array.from(dsl.storage.filters.get(id).subfilters)[0]]);
    });
  });
});
