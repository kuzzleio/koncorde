const
  should = require('should'),
  FieldOperand = require('../../lib/storage/objects/fieldOperand'),
  DSL = require('../../');

describe('DSL.keyword.nothing', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#storage', () => {
    it('should register in the store', () => {
      return dsl.register('index', 'collection', {nothing: 'anything'})
        .then(subscription => {
          const storeEntry = dsl.storage.foPairs.get('index', 'collection', 'nothing');

          should(storeEntry)
            .be.instanceof(FieldOperand);
          should(storeEntry.fields.get('all'))
            .eql([Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0]]);
        });
    });
  });
});
