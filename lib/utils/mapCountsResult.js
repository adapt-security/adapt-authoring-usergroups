/**
 * Reduces a `$group` aggregation result into a plain map of group id → member count.
 * @param {Array<{_id: *, count: Number}>} results Aggregation output, one entry per group id
 * @return {Object<String,Number>} Map keyed by stringified group id
 * @memberof usergroups
 */
export function mapCountsResult (results = []) {
  return results.reduce((map, { _id, count }) => {
    if (_id != null) map[_id.toString()] = count
    return map
  }, {})
}
