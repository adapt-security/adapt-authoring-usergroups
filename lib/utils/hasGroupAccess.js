/**
 * Checks whether a resource has been shared with a group the requesting user belongs to.
 * Returns false when the resource is shared with no groups; open access is expressed
 * separately by the additive `_access.public` grant.
 * @param {Array} docGroups The resource's `_access.groups` (group ids)
 * @param {Array} userGroups The requesting user's group memberships (`user.userGroups`)
 * @return {Boolean}
 * @memberof usergroups
 */
export function hasGroupAccess (docGroups, userGroups) {
  if (!docGroups?.length || !userGroups?.length) return false
  const memberships = new Set(userGroups.map(g => g.toString()))
  return docGroups.some(g => memberships.has(g.toString()))
}
