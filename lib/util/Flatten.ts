import { JSONObject } from '../types/JSONObject';

/**
 * Flatten an object transform:
 * {
 *  title: "kuzzle",
 *  info : {
 *    tag: "news"
 *  }
 * }
 *
 * Into an object like:
 * {
 *  title: "kuzzle",
 *  info.tag: news
 * }
 *
 * @param {Object} target the object we have to flatten
 * @returns {Object} the flattened object
 */
export function flattenObject(target: JSONObject): JSONObject {
  const output = {};

  flattenStep(output, target);

  return output;
}

function flattenStep(
  output: JSONObject,
  object: JSONObject,
  prev: string = null): void {
  const keys = Object.keys(object);

  for(let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = object[key];
    const newKey = prev ? prev + '.' + key : key;

    if (Object.prototype.toString.call(value) === '[object Object]') {
      output[newKey] = value;
      flattenStep(output, value, newKey);
    }

    output[newKey] = value;
  }
}