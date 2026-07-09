import AbstractApiModule, { addAccessClause } from 'adapt-authoring-api'
import { hasGroupAccess, mapCountsResult } from './utils.js'
/**
 * Module which handles groups of users
 * @extends {AbstractApiModule}
 */
class UserGroupsModule extends AbstractApiModule {
  /** @override */
  async setValues () {
    await super.setValues()
    /** @ignore */ this.schemaName = 'usergroup'
    /** @ignore */ this.collectionName = 'usergroups'
    /** @ignore */ this.membershipExtension = 'usergroups'
    /** @ignore */ this.grantExtension = 'groups'
    /**
     * Modules registered for group access, each as `{ mod, field }` where `field` is the
     * array holding group ids to strip on cascade delete (`userGroups` for the membership
     * owner, `_access.groups` for shareable resources)
     * @type {Array<{mod: AbstractApiModule, field: String}>}
     */
    this.modules = []
  }

  /** @override */
  async init () {
    await super.init()
    const mongodb = await this.app.waitForModule('mongodb')
    // group labels are unique case-insensitively but stored with the author's casing
    await mongodb.setIndex(this.collectionName, { displayName: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } })
    // users carry group membership (the userGroups field); their own documents aren't
    // access-gated by it, but group refs are cleaned up on delete
    await this.registerMembership(await this.app.waitForModule('users'))
    // assets are a flat, shareable collection — grant group access additively
    await this.registerGroupModule(await this.app.waitForModule('assets'))
    // courses carry the _access.groups grant on the course document; the grant itself
    // (including child-content inheritance) is applied by adaptframework's content-access
    // filter — see adapt-authoring-adaptframework#194 — so we only add the field here
    await this.registerCourseGroups(await this.app.waitForModule('content'))
  }

  /**
   * Registers the membership owner (users): adds the `userGroups` membership field and
   * tracks it for cascade cleanup. No access grant — a user's membership list is not an
   * access restriction on the user document itself.
   * @param {AbstractApiModule} mod
   */
  async registerMembership (mod) {
    if (!mod.schemaName) {
      return this.log('warn', 'cannot register membership module, no schemaName defined')
    }
    const jsonschema = await this.app.waitForModule('jsonschema')
    jsonschema.extendSchema(mod.schemaName, this.membershipExtension)
    this.modules.push({ mod, field: 'userGroups' })
    this.log('debug', `registered ${mod.name} for group membership`)
  }

  /**
   * Registers a shareable module for additive group access: extends its schema with
   * `_access.groups` and taps both access hooks so sharing a resource with a group the
   * user belongs to *widens* access (it never restricts). Use for flat resources (assets).
   * @param {AbstractApiModule} mod
   */
  async registerGroupModule (mod) {
    if (!mod.schemaName) {
      return this.log('warn', 'cannot register group module, no schemaName defined')
    }
    const jsonschema = await this.app.waitForModule('jsonschema')
    jsonschema.extendSchema(mod.schemaName, this.grantExtension)
    mod.accessCheckHook.tap(this.checkGroupAccess)
    mod.accessQueryHook.tap(this.grantGroupAccess)
    this.modules.push({ mod, field: '_access.groups' })
    this.log('debug', `registered ${mod.name} for group access`)
  }

  /**
   * Registers course-level group sharing: adds `_access.groups` to the course schema and
   * tracks the content module for cascade cleanup. No hook is tapped here — the grant
   * (and child-content inheritance) is applied by adaptframework's content-access filter.
   * @param {AbstractApiModule} content
   */
  async registerCourseGroups (content) {
    const jsonschema = await this.app.waitForModule('jsonschema')
    jsonschema.extendSchema('course', this.grantExtension)
    this.modules.push({ mod: content, field: '_access.groups' })
    this.log('debug', 'registered content (course) for group access')
  }

  /**
   * Per-item group grant (an `accessCheckHook` observer): grants access when the resource
   * is shared with a group the requesting user belongs to.
   * @param {external:ExpressRequest} req
   * @param {Object} resource
   * @return {Boolean}
   */
  checkGroupAccess (req, resource) {
    return hasGroupAccess(resource?._access?.groups, req.auth?.user?.userGroups)
  }

  /**
   * Query-level group grant (an `accessQueryHook` observer): widens the query to include
   * resources shared with any group the user belongs to. No-op when the user has no groups.
   * @param {external:ExpressRequest} req
   */
  grantGroupAccess (req) {
    const groups = req.auth?.user?.userGroups
    if (groups?.length) addAccessClause(req.apiData.query, { '_access.groups': { $in: groups } })
  }

  /** @override */
  async insert (data, options, mongoOptions) {
    try {
      return await super.insert(data, options, mongoOptions)
    } catch (e) {
      if (e.code === this.app.errors.MONGO_DUPL_INDEX) throw this.app.errors.DUPL_USERGROUP.setData({ displayName: data.displayName })
      throw e
    }
  }

  /** @override */
  async update (query, data, options, mongoOptions) {
    try {
      return await super.update(query, data, options, mongoOptions)
    } catch (e) {
      if (e.code === this.app.errors.MONGO_DUPL_INDEX) throw this.app.errors.DUPL_USERGROUP.setData({ displayName: data.displayName })
      throw e
    }
  }

  /** @override */
  async delete (...args) {
    const doc = await super.delete(...args)
    await Promise.all(this.modules.map(async ({ mod, field }) => {
      const docs = await mod.find({ [field]: doc._id })
      return Promise.all(docs.map(async d => {
        try {
          await mod.update({ _id: d._id }, { $pull: { [field]: doc._id } }, { rawUpdate: true })
        } catch (e) {
          this.log('warn', `Failed to remove usergroup, ${e}`)
        }
      }))
    }))
    return doc
  }

  /**
   * Returns a map of group id → number of users in that group, for the member
   * counts shown in the groups admin UI.
   */
  async getCounts (req, res, next) {
    try {
      const [mongodb, users] = await this.app.waitForModule('mongodb', 'users')
      const results = await mongodb.getCollection(users.collectionName).aggregate([
        { $unwind: '$userGroups' },
        { $group: { _id: '$userGroups', count: { $sum: 1 } } }
      ]).toArray()
      res.json(mapCountsResult(results))
    } catch (e) {
      next(e)
    }
  }
}

export default UserGroupsModule
