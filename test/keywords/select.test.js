const should = require('should/as-function');

const FieldOperand = require('../../lib/engine/objects/fieldOperand');
const { Koncorde } = require('../../');

describe('Koncorde.keyword.select', () => {
  let koncorde;
  let engine;

  beforeEach(() => {
    koncorde = new Koncorde();
    engine = koncorde.engines.get(null);
  });

  function getSubfilter(id) {
    return Array.from(engine.filters.get(id).subfilters)[0];
  }

  describe('#validation', () => {
    it('should reject non-object filters', () => {
      should(() => koncorde.validate({select: ['foo', 'bar']}))
        .throw({
          keyword: 'select',
          message: '"select": must be an object',
          path: 'select',
        });
    });

    it('should reject empty filters', () => {
      should(() => koncorde.validate({select: {}}))
        .throw({
          keyword: 'select',
          message: '"select": expected object to have exactly 3 properties, got 0',
          path: 'select',
        });
    });

    it('should reject filters with missing field "field"', () => {
      should(() => koncorde.validate({select: {
        foo: 'bar',
        index: 0,
        query: {
          equals: {value: 'bar'}
        }
      }}))
        .throw({
          keyword: 'select',
          message: '"select.field": must be a string',
          path: 'select.field',
        });
    });

    it('should reject filters with missing field "index"', () => {
      should(() => koncorde.validate({select: {
        foo: 'bar',
        field: 'foo',
        query: {
          equals: {value: 'bar'}
        }
      }}))
        .throw({
          keyword: 'select',
          message: '"select.index": must be an integer',
          path: 'select.index',
        });
    });

    it('should reject filters with missing field "query"', () => {
      should(() => koncorde.validate({select: {
        foo: 'bar',
        field: 'foo',
        index: 0,
      }}))
        .throw({
          keyword: 'select',
          message: '"select.query": must be an object',
          path: 'select.query',
        });
    });

    it('should reject filters when field is not a string', () => {
      should(() => koncorde.validate({select: {
        field: 42,
        index: 0,
        query: {
          equals: {value: 'bar'}
        }
      }}))
        .throw({
          keyword: 'select',
          message: '"select.field": must be a string',
          path: 'select.field',
        });
    });

    it('should reject filters when index is not an integer', () => {
      should(() => koncorde.validate({select: {
        field: 'foo',
        index: 1.2,
        query: {
          equals: {value: 'bar'}
        }
      }}))
        .throw({
          keyword: 'select',
          message: '"select.index": cannot have decimals, must be an integer',
          path: 'select.index',
        });
    });

    it('should reject filters when query is not a valid Koncorde query', () => {
      should(() => koncorde.validate({select: {
        field: 'foo',
        index: 0,
        query: {
          yeet: {foo: 'bar'}
        }
      }}))
        .throw({
          keyword: 'yeet',
          message: '"select.query.yeet": unknown keyword',
          path: 'select.query.yeet',
        });
    });
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      should(koncorde.transformer.standardizer.standardize({
        select: {
          field: 'foo',
          index: 0,
          query: {
            equals: { value: 'bar' }
          }
        }
      }))
        .match({
          select: {
            field: 'foo',
            index: 0,
            query: {
              equals: { value: 'bar' }
            }
          }
        });
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      const id = koncorde.register({
        select: {
          field: 'foo',
          index: 0,
          query: {
            equals: { value: 'bar' }
          }
        }
      });
      
      const storage = engine.foPairs.get('select');
      const subfilter = getSubfilter(id);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo'))
        .instanceOf(Map);
      should(storage.fields.get('foo').get(0).filters.size).equal(1);
      const subfilters = Array.from(storage.fields.get('foo').get(0).filters.values()).flat();
      should(subfilters.findIndex(f => f.id === subfilter.id)).not.equal(-1);
    });

    it('should store multiple conditions on the same field correctly', () => {
      const id1 = koncorde.register({
        select: {
          field: 'foo',
          index: 0,
          query: {
            equals: { value: 'bar' }
          }
        }
      });
      const id2 = koncorde.register({
        select: {
          field: 'foo',
          index: 0,
          query: {
            equals: { value: 'qux' }
          }
        }
      });

      const barSubfilter = getSubfilter(id1);
      const quxSubfilter = getSubfilter(id2);
      const storage = engine.foPairs.get('select');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo'))
        .instanceOf(Map);
      should(storage.fields.get('foo').get(0).filters.size).equal(2);
      const subfilters = Array.from(storage.fields.get('foo').get(0).filters.values()).flat();
      should(subfilters.findIndex(f => f.id === barSubfilter.id)).not.equal(-1);
      should(subfilters.findIndex(f => f.id === quxSubfilter.id)).not.equal(-1);
    });

    it('should store multiple subfilters on the same condition correctly', () => {
      const id1 = koncorde.register({
        select: {
          field: 'foo',
          index: 0,
          query: {
            equals: { value: 'bar' }
          }
        }
      });
      
      const id2 = koncorde.register({
        and: [
          {
            select: {
              field: 'baz',
              index: 0,
              query: {
                equals: { value: 'qux' }
              }
            }
          },
          {
            select: {
              field: 'foo',
              index: 0,
              query: {
                equals: { value: 'bar' }
              }
            }
          }
        ]
      });

      const barSubfilter = getSubfilter(id1);
      const multiSubfilter = getSubfilter(id2);
      const storage = engine.foPairs.get('select');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('baz'))
        .instanceOf(Map);
      should(storage.fields.get('baz').get(0).filters.size).equal(1);
      let subfilters = Array.from(storage.fields.get('baz').get(0).filters.values()).flat();
      should(subfilters.findIndex(f => f.id === multiSubfilter.id)).not.equal(-1);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo'))
        .instanceOf(Map);
      should(storage.fields.get('foo').get(0).filters.size).equal(1);
      subfilters = Array.from(storage.fields.get('foo').get(0).filters.values()).flat();
      should(subfilters.length).equal(2);
      should(subfilters.findIndex(f => f.id === barSubfilter.id)).not.equal(-1);
      should(subfilters.findIndex(f => f.id === multiSubfilter.id)).not.equal(-1);
      
    });
  });

  describe('#matching', () => {
    it('should match a document with the subscribed keyword', () => {
      const id = koncorde.register({
        select: {
          field: 'foo',
          index: -1,
          query: {
            equals: { value: 'bar' }
          }
        }
      });
      const result = koncorde.test({foo: ['qux', 'bar']});

      should(result).be.an.Array().and.not.empty();
      should(result[0]).be.eql(id);
    });

    it('should not match if the document contains the field with another value', () => {
      koncorde.register({
        select: {
          field: 'foo',
          index: -1,
          query: {
            equals: { value: 'bar' }
          }
        }
      });

      should(koncorde.test({foo: ['bar', 'qux']})).be.an.Array().and.be.empty();
    });

    it('should not match if the document contains another field with the registered value', () => {
      koncorde.register({
        select: {
          field: 'foo',
          index: 0,
          query: {
            equals: { value: 'bar' }
          }
        }
      });
      should(koncorde.test({ qux: ['bar'] })).be.an.Array().and.be.empty();
    });

    // see https://github.com/kuzzleio/koncorde/issues/13
    it('should skip the matching if the document tested property is not of the same type than the known values', () => {
      koncorde.register({
        select: {
          field: 'foo',
          index: 0,
          query: {
            equals: { value: 'bar' }
          }
        }
      });

      should(koncorde.test({ foo: 'bar' })).be.an.Array().and.empty();

      should(koncorde.test({ foo: { bar: true } })).be.an.Array().and.empty();
    });

    it('should match a document with the subscribed nested keyword', () => {
      const id = koncorde.register({
        select: {
          field: 'foo.bar.baz',
          index: 0,
          query: {
            equals: { value: 'qux' }
          }
        }
      });
      const result = koncorde.test({ foo: { bar: { baz: ['qux'] } } });

      should(result).be.an.Array().and.not.empty();
      should(result[0]).be.eql(id);
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const id = koncorde.register({
        select: {
          field: 'foo',
          index: 0,
          query: {
            equals: { value: 'bar' }
          }
        }
      });

      koncorde.remove(id);

      should(engine.foPairs).be.an.Object().and.be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const id1 = koncorde.register({
        select: {
          field: 'foo',
          index: 0,
          query: {
            equals: { value: 'bar' }
          }
        }
      });
      const id2 = koncorde.register({
        and: [
          {
            select: {
              field: 'baz',
              index: 0,
              query: {
                equals: { value: 'qux' }
              }
            }
          },
          {
            select: {
              field: 'foo',
              index: 0,
              query: {
                equals: { value: 'bar' }
              }
            }
          },
        ],
      });

      koncorde.remove(id1);

      const storage = engine.foPairs.get('select');
      const multiSubfilter = getSubfilter(id2);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('baz'))
        .instanceOf(Map);
      should(storage.fields.get('baz').get(0).filters.size).equal(1);
      let subfilters = Array.from(storage.fields.get('baz').get(0).filters.values()).flat();
      should(subfilters.length).equal(1);
      should(subfilters.findIndex(f => f.id === multiSubfilter.id)).not.equal(-1);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo'))
        .instanceOf(Map);
      should(storage.fields.get('foo').get(0).filters.size).equal(1);
      subfilters = Array.from(storage.fields.get('foo').get(0).filters.values()).flat();
      should(subfilters.length).equal(1);
      should(subfilters.findIndex(f => f.id === multiSubfilter.id)).not.equal(-1);
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      const id1 = koncorde.register({
        select: {
          field: 'foo',
          index: 0,
          query: {
            equals: { value: 'bar' }
          }
        }
      });
      const id2 = koncorde.register({
        select: {
          field: 'foo',
          index: 1,
          query: {
            equals: { value: 'qux' }
          }
        }
      });

      const storage = engine.foPairs.get('select');
      const barSubfilter = getSubfilter(id1);
      const quxSubfilter = getSubfilter(id2);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo'))
        .instanceOf(Map);
      should(storage.fields.get('foo').get(0).filters.size).equal(1);
      let subfilters = Array.from(storage.fields.get('foo').get(0).filters.values()).flat();
      should(subfilters.length).equal(1);
      should(subfilters.findIndex(f => f.id === barSubfilter.id)).not.equal(-1);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo'))
        .instanceOf(Map);
      should(storage.fields.get('foo').get(1).filters.size).equal(1);
      subfilters = Array.from(storage.fields.get('foo').get(1).filters.values()).flat();
      should(subfilters.length).equal(1);
      should(subfilters.findIndex(f => f.id === quxSubfilter.id)).not.equal(-1);

      koncorde.remove(id2);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo'))
        .instanceOf(Map);
      should(storage.fields.get('foo').get(0).filters.size).equal(1);
      subfilters = Array.from(storage.fields.get('foo').get(0).filters.values()).flat();
      should(subfilters.length).equal(1);
      should(subfilters.findIndex(f => f.id === barSubfilter.id)).not.equal(-1);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo'))
        .instanceOf(Map);
      should(storage.fields.get('foo').get(1)).be.undefined();
    });
  });
});
