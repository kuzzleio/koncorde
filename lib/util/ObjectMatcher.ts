import { JSONObject } from "../types/JSONObject";

/**
 * Verifies that the provided `obj` value matches the provided `toMatch` value
 * 
 * @param obj The value that should match the `toMatch` property
 * @param toMatch The value that the `obj` property should match
 */
export function matchAny(obj: any, toMatch: any): boolean {
  if (typeof obj !== typeof toMatch) {
      return false;
  }

  if (typeof obj === 'object' && obj !== null && toMatch !== null) {
      if (Array.isArray(obj) !== Array.isArray(toMatch)) {
          return false;
      }

      if (Array.isArray(obj)) {
          return matchArray(obj, toMatch);
      } else {
          return matchObject(obj, toMatch);
      }
  } else {
      return obj === toMatch;
  }
}

/**
 * Verifies that each values of `match` array are contained in `array` array
 * 
 * @param array The array that should contain every values of `match` array
 * @param match The array that should be contained in `array`
 */
export function matchArray(array: Array<any>, match: Array<any>): boolean {
  if (array.length < match.length) {
      return false;
  };

  const document = [];
  for (let i = 0; i < array.length; i++) {
      document[i] = array[i];
  }

  for (let i = 0; i < match.length; i++) {
      const toMatch = match[i];
      let found = false;
      for (let j = 0; j < document.length; j++) {
          if (matchAny(document[j], toMatch)) {
              document.splice(j, 1);
              found = true;
              break;
          }
      }
      if (!found) {
          return false;
      }
  }

  return true;
}

/**
 * Verifies that each properties of `match` object are contained in `obj` object
 * 
 * @param obj The object that should contain every properties of `match` object
 * @param match The object that should be contained in `obj`
 */
export function matchObject(obj: JSONObject, match: JSONObject): boolean {
  /**
   * Why not using Object.keys()?
   * 
   * Object.keys() forces us to iterate over all properties of the object to list them first, before we can iterate over them.
   * 
   * In this case we might early exit if we find a property that doesn't match, this means
   * we might not test every properties.
   * So, to reduce the overhead we iterate over the properties of the match object one by one as we test them.
   * This is way faster than doing Object.keys() and then iterating over the result when Objects gets bigger.
   * On objects with ~20 properties, this is ~2x faster than doing Object.keys().
   */
  for (const key in match) {
      if (!matchAny(obj[key], match[key])) {
          return false;
      }
  }
  return true;
}