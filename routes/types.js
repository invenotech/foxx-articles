'use strict';
const dd = require('dedent');
const joi = require('joi');

const aql = require('@arangodb').aql;
const { db } = require('@arangodb');
const sessions = module.context.dependencies.sessions;
const hasRole = module.context.dependencies.permissions;

module.context.use(sessions);

const httpError = require('http-errors');
const status = require('statuses');
const errors = require('@arangodb').errors;

const ARANGO_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code;
const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code;
const ARANGO_CONFLICT = errors.ERROR_ARANGO_CONFLICT.code;
const HTTP_NOT_FOUND = status('not found');
const HTTP_CONFLICT = status('conflict');

const articleTypes = db._collection('articleTypes');

const createRouter = require('@arangodb/foxx/router');
const router = createRouter();

router
  .get(function (req, res) {
    if (!hasRole(req, 'article_types_view')) {
      res.throw(401, `Unathorized`);
    }
    let articleType;
    try {
      articleType = db._query(aql`
        FOR articleType IN ${articleTypes}
          SORT articleType.name
          RETURN articleType
      `);
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      throw e;
    }
    res.send(articleType);
  }, 'detail')

  .summary('Fetch all Article Types').description(dd`
  Retrieves all article types.
`);

module.exports = router;
