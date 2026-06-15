import AbstractApiModule from 'adapt-authoring-api'
import { buildGroupAccessQuery, mapCountsResult } from './utils.js'
/**
 * Module which handles groups of users
 * @extends {AbstractApiModule}
 */
class UserGroupsModule extends AbstractApiModule {
  /** @override */
  async setValues () {
    await super.setValues()
    /** @ignore */ this.schemaName = 'usergroup'
    /** @ignore */ this.schemaExtensionName = 'usergroups'
    /** @ignore */ this.collectionName = 'usergroups'
    /**
     * Modules registered for user groups
     * @type {Array<AbstractApiModule>}
     */
    this.modules = []
  }

  /** @override */
  async init () {
    await super.init()
    const mongodb = await this.app.waitForModule('mongodb')
    // group labels are unique case-insensitively but stored with the author's casing
    await mongodb.setIndex(this.collectionName, { displayName: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } })
    // users carry group membership (the userGroups field) and need group refs
    // cleaned up on delete, but their own documents aren't access-gated by it
    await this.registerModule(await this.app.waitForModule('users'), { gateAccess: false })
    // assets are a flat, shareable collection — group-gate them at the query level
    await this.registerModule(await this.app.waitForModule('assets'))
    // courses are gated by their own groups; their child content inherits the
    // course's access (resolved per query — see gateContentByCourse)
    await this.gateContentByCourse(await this.app.waitForModule('content'))
  }

  /**
   * Registers the content module for course-level group sharing. Only the course
   * schema carries `userGroups`; the access *grant* is additive and lives with
   * the other content sharing dimensions in adaptframework (owner / `_isShared` /
   * `_shareWithUsers`), so a group is just another way to gain access — we don't
   * tap an access hook here. We only add the field and register for the
   * cascade cleanup that strips a deleted group's id from courses.
   * @param {AbstractApiModule} content
   */
  async gateContentByCourse (content) {
    const jsonschema = await this.app.waitForModule('jsonschema')
    // the userGroups field lives on the course schema only, not child content
    jsonschema.extendSchema('course', this.schemaExtensionName)
    this.modules.push(content)
  }

  /**
   * Registers a module for use with this plugin. Extends the module's schema with the
   * userGroups field and tracks it for cascade cleanup. When `gateAccess` is set (the
   * default), the module's documents become readable only to users who share a group
   * with them — use this for shareable content (courses, assets). Pass
   * `gateAccess: false` for the membership owner (users), whose userGroups is a
   * membership list, not an access restriction on the user document itself.
   * @param {AbstractApiModule} mod
   * @param {Object} [options]
   * @param {Boolean} [options.gateAccess=true] Whether to access-gate the module's documents by group
   */
  async registerModule (mod, { gateAccess = true } = {}) {
    if (!mod.schemaName) {
      return this.log('warn', 'cannot register module, module doesn\'t define a schemaName')
    }
    const jsonschema = await this.app.waitForModule('jsonschema')
    jsonschema.extendSchema(mod.schemaName, this.schemaExtensionName)
    if (gateAccess) {
      // gate at the query level (not accessCheckHook, which filters post-query and
      // returns short pages / wrong counts): restrict to docs the user's groups
      // can see. accessQueryHook only runs for non-super users; mongo find casts
      // the group id strings to ObjectIds.
      mod.accessQueryHook.tap(req => {
        const query = req.apiData.query
        query.$and = [...(query.$and ?? []), buildGroupAccessQuery(req.auth?.user?.userGroups)]
      })
    }
    this.log('debug', `registered ${mod.name} for use with usergroups`)
    this.modules.push(mod)
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
    await Promise.all(this.modules.map(async m => {
      const docs = await m.find({ userGroups: doc._id })
      return Promise.all(docs.map(async d => {
        try {
          await m.update({ _id: d._id }, { $pull: { userGroups: doc._id } }, { rawUpdate: true })
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
