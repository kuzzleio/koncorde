const should = require('should/as-function');

const FieldOperand = require('../../lib/engine/objects/fieldOperand');
const { Koncorde } = require('../../');

describe('Koncorde.keyword.nothing', () => {
  let koncorde;
  let engine;

  beforeEach(() => {
    koncorde = new Koncorde();
    engine = koncorde.engines.get(null);
  });

  describe('#storage', () => {
    it('should register in the store', () => {
      const id = koncorde.register({ nothing: 'anything' });

      const storeEntry = engine.foPairs.get('nothing');

      should(storeEntry).be.instanceof(FieldOperand);
      should(storeEntry.fields.get('all'))
        .eql([Array.from(engine.filters.get(id).subfilters)[0]]);
    });
  });
});
