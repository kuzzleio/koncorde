const should = require('should/as-function');

const DSL = require('../../');
const NormalizedExists = require('../../lib/transform/normalizedExists');

describe('DSL.operands.bool', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(dsl.validate({bool: {}}))
        .be.rejectedWith('"bool" must be a non-empty object');
    });

    it('should reject filters with unrecognized bool attributes', () => {
      const filter = {
        bool: {
          must: [
            {exists: {foo: 'bar'}},
          ],
          foo: 'bar',
        },
      };

      return should(dsl.validate(filter))
        .be.rejectedWith('"bool" operand accepts only the following attributes: must, must_not, should, should_not');
    });
  });

  describe('#standardization', () => {
    it('should standardize bool attributes with AND/OR/NOT operands', () => {
      const bool = {
        bool: {
          must : [
            {
              in : {
                firstName : ['Grace', 'Ada']
              }
            },
            {
              range: {
                age: {
                  gte: 36,
                  lt: 85
                }
              }
            }
          ],
          'must_not' : [
            {
              equals: {
                city: 'NYC'
              }
            }
          ],
          should : [
            {
              equals : {
                hobby : 'computer'
              }
            },
            {
              exists : 'lastName'
            }
          ],
          should_not: [
            {
              regexp: {
                hobby: {
                  value: '^.*ball',
                  flags: 'i'
                }
              }
            }
          ]
        }
      };

      const result = dsl.transformer.standardizer.standardize(bool);
      should(result).match({
        and: [
          {or: [
            {equals: {firstName: 'Grace'}},
            {equals: {firstName: 'Ada'}}
          ]},
          {or: [
            {equals: {hobby: 'computer'}},
            {exists: new NormalizedExists('lastName', false, null)}
          ]},
          {and: [
            {range: {age: {gte: 36, lt: 85}}},
            {not: {equals: {city: 'NYC'}}},
            {not: {regexp: {hobby: {value: '^.*ball', flags: 'i'}}}}
          ]}
        ]
      });
    });
  });
});
