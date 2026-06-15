/**
 * Builds the mongo clause that scopes a query to documents the requesting user
 * may access by group membership. A document is accessible when it carries no
 * group restrictions (i.e. it's public) OR it shares at least one group with
 * the user. This is the query-level equivalent of `hasGroupAccess`, used in an
 * `accessQueryHook` so list endpoints stay pagination-accurate.
 * @param {Array} userGroups The requesting user's userGroups (ids; strings or ObjectIds — mongo find normalises)
 * @return {Object} A mongo `$or` clause to AND into the query
 * @memberof usergroups
 */
export function buildGroupAccessQuery (userGroups = []) {
  return {
    $or: [
      { userGroups: { $exists: false } },
      { userGroups: { $size: 0 } },
      { userGroups: { $in: userGroups ?? [] } }
    ]
  }
}
