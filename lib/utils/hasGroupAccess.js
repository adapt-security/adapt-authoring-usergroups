/**
 * Checks whether a user shares at least one group with a document.
 * Returns true if the document carries no group restrictions (i.e. it's public).
 * @param {Array} docGroups The userGroups array from the document being accessed
 * @param {Array} userGroups The userGroups array from the requesting user
 * @return {Boolean}
 * @memberof usergroups
 */
export function hasGroupAccess (docGroups, userGroups) {
  if (!docGroups?.length) return true
  if (!userGroups?.length) return false
  const userSet = new Set(userGroups.map(g => g.toString()))
  return docGroups.some(g => userSet.has(g.toString()))
}
