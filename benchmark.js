/* eslint-disable no-console */

const v8 = require('v8');

const Benchmark = require('benchmark');
const georandom = require('geojson-random');
const {
  MersenneTwister19937,
  string: randomStringEngine,
  integer: randomIntegerEngine
} = require('random-js');

const Koncorde = require('.');

const max = 10000;
const engine = MersenneTwister19937.autoSeed();
const rgen = {
  int: randomIntegerEngine(-10000, 10000),
  string: randomStringEngine(),
};

let filters = [];
const koncorde = new Koncorde();

const matching = document => {
  const suite = new Benchmark.Suite();

  suite
    .add('\tMatching', () => {
      koncorde.test(document);
    })
    .on('cycle', event => {
      console.log(String(event.target));
      removeFilters();
    })
    .run({async: false});
};

function removeFilters() {
  const removalStart = Date.now();

  for (const filter of filters) {
    koncorde.remove(filter);
  }

  filters = [];
  console.log(`\tFilters removal: time = ${(Date.now() - removalStart)/1000}s`);
}

function test (name, generator, document) {
  const baseHeap = v8.getHeapStatistics().total_heap_size;

  console.log(`\n> Benchmarking keyword: ${name}`);
  const filterStartTime = Date.now();

  for (let i = 0;i < max; i++) {
    // Using the filter name as a collection to isolate
    // benchmark calculation per keyword
    filters.push(koncorde.register(generator()));
  }

  const filterEndTime = (Date.now() - filterStartTime) / 1000;
  console.log(`\tIndexation: time = ${filterEndTime}s, mem = +${Math.round((v8.getHeapStatistics().total_heap_size - baseHeap) / 1024 / 1024)}MB`);

  matching(document);
}

function run () {
  test(
    'equals',
    () => ({equals: {str: rgen.string(engine, 20)}}),
    { str: rgen.string(engine, 20) });

  test(
    'exists',
    () => ({exists: {field: rgen.string(engine, 20)}}),
    { [rgen.string(engine, 20)]: true });

  test('geoBoundingBox',
    () => {
      const pos = georandom.position();

      return {
        geoBoundingBox: {
          point: {
            bottom: pos[1] - .5,
            left: pos[0],
            right: pos[0] + .5,
            top: pos[1],
          }
        }
      };
    },
    { point: [0, 0] });

  test('geoDistance',
    () => {
      const pos = georandom.position();

      return {
        geoDistance: {
          distance: '500m',
          point: [pos[1], pos[0]],
        }
      };
    },
    { point: [0, 0] });

  test('geoDistanceRange',
    () => {
      const pos = georandom.position();

      return {
        geoDistanceRange: {
          from: '500m',
          point: [pos[1], pos[0]],
          to: '1km',
        }
      };
    },
    { point: [0, 0] });

  test('geoPolygon (5 vertices)',
    () => {
      const polygon = georandom
        .polygon(1, 5)
        .features[0]
        .geometry.coordinates[0].map(c => [c[1], c[0]]);

      return {
        geoPolygon: {
          point: {
            points: polygon
          }
        }
      };
    },
    { point: [0, 0] });

  test('in (5 random values)',
    () => {
      const values = [];

      for(let i = 0; i < 5; i++) {
        values.push(rgen.string(engine, 20));
      }

      return {in: {str: values}};
    },
    { str: rgen.string(engine, 20) });

  test('range (random bounds)',
    () => {
      const bound = rgen.int(engine);

      return {
        range: {
          integer: {
            gte: bound,
            lte: bound + 100
          }
        }
      };
    },
    { integer: rgen.int(engine) });
}

console.log(`Filter count per tested keyword: ${max}`);
run();
