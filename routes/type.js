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

const articles = db._collection('articles');
const articleTypes = db._collection('articleTypes');
const users = db._collection('users');

const createRouter = require('@arangodb/foxx/router');
const router = createRouter();

router.get(
  '/name/:name',
  function (req, res) {
    if (!hasRole(req, 'article_types_view')) {
      res.throw(401, `Unathorized`);
    }
    const { name } = req.pathParams;

    let articleType;
    try {
      articleType = articleTypes.firstExample({ name });
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      throw e;
    }
    res.send(articleType);
  },
  'detail'
);

router
  .get(
    '/id/:_key',
    function (req, res) {
      if (!hasRole(req, 'article_types_view')) {
        res.throw(401, `Unathorized`);
      }
      const { _key } = req.pathParams;
      let articleType;
      try {
        articleType = articleTypes.document(_key);
      } catch (e) {
        if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
          throw httpError(HTTP_NOT_FOUND, e.message);
        }
        throw e;
      }
      res.send(articleType);
    },
    'detail'
  )
  .pathParam('_key')
  .summary('Fetch a publication').description(dd`
  Retrieves a publication.
`);

router
  .post('/', function (req, res) {
    if (!hasRole(req, 'article_types_update')) {
      res.throw(401, `Unathorized`);
    }
    const { description, name, options, slug, title, urlFormat } = req.body;

    articleTypes.save({
      description,
      name,
      options,
      slug,
      title,
      urlFormat
    });
    res.status(200, `Article Type Created`);
  })
  .body(
    joi
      .object({
        description: joi.any(),
        name: joi.string().required(),
        options: joi.object().required(),
        slug: joi.string().required(),
        title: joi.string().required(),
        urlFormat: joi.string().required()
      })
      .required()
  );

router
  .get(
    '/:articleTypeSlug/content/:articleSlug',
    function (req, res) {
      if (!hasRole(req, 'articles_view')) {
        res.throw(401, `Unathorized`);
      }
      const { articleTypeSlug, articleSlug } = req.pathParams;
      let articleType;
      try {
        articleType = articleTypes.firstExample({ slug: articleTypeSlug });
      } catch (e) {
        if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
          throw httpError(HTTP_NOT_FOUND, e.message);
        }
        throw e;
      }
      let article;
      try {
        article = db._query(aql`
        FOR article IN ${articles}
          FILTER article.articleTypeId == ${articleType._key} && article.slug == ${articleSlug}
            FOR user IN ${users}
              FILTER user._key == article.userId
            RETURN {
              "_key" : article._key,
              "articleType" : ${articleType},
              "articleTypeId" : article.articleTypeId,
              "createdDate" : article.createdDate,
              "slug" : article.slug,
              "summary" : article.summary,
              "status" : article.status,
              "text" : article.text,
              "title" : article.title,
              "updatedDate" : article.updatedDate,
              "user" : user,
              "userId" : article.userId
            }`);
      } catch (e) {
        if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
          throw httpError(HTTP_NOT_FOUND, e.message);
        }
        throw e;
      }
      res.send(article);
    },
    'detail'
  )
  .pathParam('_key')
  .summary('Fetch article').description(dd`
  Retrieves article
`);

router
  .put('/:_key', function (req, res) {
    if (!hasRole(req, 'article_types_update')) {
      res.throw(401, `Unathorized`);
    }
    const { description, name, options, slug, title, urlFormat } = req.body;

    const { _key } = req.pathParams;

    if (articleTypes.firstExample({ _key })) {
      articleTypes.update(_key, {
        description,
        name,
        options,
        slug,
        title,
        urlFormat
      });
      res.status(200, `Article Type Updated`);
    } else {
      res.throw(400, `Invalid Article Type Id: ${_key}`);
    }
  })
  .body(
    joi
      .object({
        description: joi.any(),
        name: joi.string().required(),
        options: joi.object().required(),
        slug: joi.string().required(),
        title: joi.string().required(),
        urlFormat: joi.string().required()
      })
      .required()
  )
  .pathParam('_key');

router
  .delete('/:_key', function (req, res) {
    if (!hasRole(req, 'article_types_delete')) {
      res.throw(401, `Unathorized`);
    }

    const { _key } = req.pathParams;
    let articleType;
    let topic;
    let comment;

    try {
      articleType = db._query(aql`
        FOR articleType IN ${articleTypes}
          FILTER articleType._key == ${_key}
          REMOVE articleType in ${articleTypes}
      `);
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      throw e;
    }
    /*
    try {
      topic = db._query(aql`
        FOR topic IN ${topics}
          FILTER topic.articleType == ${_key}
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
          FILTER comment.articleType == ${_key}
          REMOVE comment in ${comments}
      `);
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      throw e;
    }
    */
    res.status(200, `Article Type Deleted`);
  })
  .pathParam('_key')
  .summary('Delete a publication').description(dd`
  Deletes a publication
`);

router
  .get(
    '/:slug',
    function (req, res) {
      if (!hasRole(req, 'article_types_view')) {
        res.throw(401, `Unathorized`);
      }
      const { slug } = req.pathParams;
      let articleType;
      try {
        articleType = articleTypes.firstExample({ slug });
      } catch (e) {
        if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
          throw httpError(HTTP_NOT_FOUND, e.message);
        }
        throw e;
      }
      res.send(articleType);
    },
    'detail'
  )
  .pathParam('slug')
  .summary('Fetch a publication').description(dd`
  Retrieves a publication.
`);

module.exports = router;
