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

const articleTags = db._collection('articleTags');

const createRouter = require('@arangodb/foxx/router');
const router = createRouter();

router.get(
  '/name/:name',
  function (req, res) {
    if (!req.session.uid) {
      res.throw(401, `Unathorized`);
    }
    const { name } = req.pathParams;

    let articleTag;
    try {
      articleTag = articleTags.firstExample({ name });
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      throw e;
    }
    res.send(articleTag);
  },
  'detail'
);

router
  .post('/', function (req, res) {
    if (!req.session.uid) {
      res.throw(401, `Unathorized`);
    }
    const { description, icon, name, options, title } = req.body;

    articleTags.save({
      description,
      icon,
      name,
      options,
      title
    });
    res.status(200, `Tag Created`);
  })
  .body(
    joi
      .object({
        description: joi.any(),
        icon: joi.string().required(),
        name: joi.string().required(),
        options: joi.object().required(),
        title: joi.string().required()
      })
      .required()
  );

router
  .put('/:_key', function (req, res) {
    if (!req.session.uid) {
      res.throw(401, `Unathorized`);
    }
    const { description, icon, name, options, title } = req.body;

    const { _key } = req.pathParams;

    if (articleTags.firstExample({ _key })) {
      articleTags.update(_key, {
        description,
        icon,
        name,
        options,
        title
      });
      res.status(200, `Tag Updated`);
    } else {
      res.throw(400, `Invalid Tag Id: ${_key}`);
    }
  })
  .body(
    joi
      .object({
        description: joi.any(),
        icon: joi.string().required(),
        name: joi.string().required(),
        options: joi.object().required(),
        title: joi.string().required()
      })
      .required()
  )
  .pathParam('_key');

router
  .delete('/:_key', function (req, res) {
    if (!req.session.uid) {
      res.throw(401, `Unathorized`);
    }

    const { _key } = req.pathParams;
    let articleTag;
    let topic;
    let comment;

    try {
      articleTag = db._query(aql`
        FOR articleTag IN ${articleTags}
          FILTER articleTag._key == ${_key}
          REMOVE articleTag in ${articleTags}
      `);
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      throw e;
    }

    try {
      topic = db._query(aql`
        FOR topic IN ${topics}
          FILTER topic.articleTag == ${_key}
          REMOVE topic in ${topics}
      `);
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      throw e;
    }

    try {
      comment = db._query(aql`
        FOR comment IN ${comments}
          FILTER comment.articleTag == ${_key}
          REMOVE comment in ${comments}
      `);
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      throw e;
    }

    res.status(200, `Tag Deleted`);
  })
  .pathParam('_key')
  .summary('Delete a tag').description(dd`
  Deletes a tag
`);

router
  .get(
    ':_key',
    function (req, res) {
      if (!req.session.uid) {
        res.throw(401, `Unathorized`);
      }
      const _key = req.pathParams._key;
      let articleTag;
      try {
        articleTag = articleTags.document(_key);
      } catch (e) {
        if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
          throw httpError(HTTP_NOT_FOUND, e.message);
        }
        throw e;
      }
      res.send(articleTag);
    },
    'detail'
  )
  .pathParam('_key')
  .summary('Fetch a tag').description(dd`
  Retrieves a tag.
`);

module.exports = router;
