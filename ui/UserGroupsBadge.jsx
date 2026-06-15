/**
 * Per-item chip showing the user groups an item (e.g. a course on the projects
 * dashboard) is shared with. Contributed to the collection-item badge slot;
 * renders only when the item carries `userGroups`. Resolves the group ids to
 * display names via the usergroups API (one cached/deduped query across cards).
 * @module ui/UserGroupsBadge
 */
import StatusBadge from '@adapt-ui/components/status/StatusBadge'
import Icons from '@adapt-ui/utils/icons'
import { t } from '@adapt-ui/utils/lang'
import { useApiQuery } from '@adapt-ui/hooks/useApi'

export default function UserGroupsBadge ({ item }) {
  const ids = item?.userGroups ?? []
  const { data: groups = [] } = useApiQuery('usergroups', (api) => api.get(), { enabled: ids.length > 0 })
  if (!ids.length) return null
  // map ids → display names; ids/_ids are strings in API responses
  const names = ids
    .map(id => groups.find(g => String(g._id) === String(id))?.displayName)
    .filter(Boolean)
  // names back the tooltip; the chip itself shows the group icon + count
  const label = names.length ? names.join(', ') : t('app.groups')
  return <StatusBadge dense role='default' icon={Icons.UserGroup} count={ids.length} label={label} sx={{ boxShadow: 1 }} />
}
