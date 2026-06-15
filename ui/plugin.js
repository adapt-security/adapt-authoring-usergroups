/**
 * UI plugin manifest for user groups. Contributes a per-item badge (discovered
 * by adapt-authoring-ui's vite-plugin-ui-plugins) showing the groups an item is
 * shared with, on the projects dashboard and other collection cards/rows.
 * @module ui/plugin
 */
import UserGroupsBadge from './UserGroupsBadge.jsx'

export default {
  collectionBadges: [
    { id: 'usergroups', Component: UserGroupsBadge }
  ]
}
