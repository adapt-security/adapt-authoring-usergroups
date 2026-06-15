/**
 * UI plugin manifest for user groups. Contributes a per-item badge (discovered
 * by adapt-authoring-ui's vite-plugin-ui-plugins) showing the groups an item is
 * shared with, on the projects dashboard and other collection cards/rows.
 * @module ui/plugin
 */
import UserGroupsBadge from './UserGroupsBadge.jsx'
import Icons from '@adapt-ui/utils/icons'

export default {
  collectionBadges: [
    { id: 'usergroups', Component: UserGroupsBadge }
  ],
  collectionFilters: [
    // filter the projects dashboard by a course's shared groups. userGroups is a
    // real course field, so this is a normal `{ userGroups: { $in: [...] } }`
    // query; options are sourced live from the usergroups collection.
    {
      collection: 'content',
      field: 'userGroups',
      label: 'Groups',
      icon: Icons.UserGroup,
      optionsApi: { apiRoot: 'usergroups', labelField: 'displayName' }
    }
  ]
}
