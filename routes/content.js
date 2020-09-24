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

function formatSlug(format, date, id, title = '[title not set]') {
  let url;
  let year;
  let monthDate;
  let dateDate;
  let mmDate;
  let ddDate;

  if (format === 'date-id' || format === 'date-title') {
    const dateObject = new Date(date);
    year = dateObject.getFullYear();
    monthDate = dateObject.getMonth() + 1;
    dateDate = dateObject.getDate();
    mmDate = monthDate >= 10 ? monthDate : `0${monthDate}`;
    ddDate = dateDate >= 10 ? dateDate : `0${dateDate}`;
  }

  switch (format) {
    case 'date-id':
      url = `${year}-${mmDate}-${ddDate}-${id}`;
      break;
    case 'date-title':
      url = `${year}-${mmDate}-${ddDate}-${title}`;
      break;
    case 'id':
      url = `${id}`;
      break;
    case 'id-title':
      url = `${id}-${title}`;
      break;
    case 'title':
      url = `${title}`;
      break;
    case 'title-id':
      url = `${title}-${id}`;
      break;
    default:
      url = `${title}-${id}`;
      break;
  }
  return url;
}

router
  .post('/', function (req, res) {
    if (!hasRole(req, 'articles_update')) {
      res.throw(401, `Unathorized`);
    }
    const {
      articleTypeId,
      createdDate,
      sanitizedTitle,
      slugFormat,
      status,
      summary,
      text,
      title,
      userId
    } = req.body;

    const article = articles.save({
      articleTypeId,
      createdDate,
      status,
      summary,
      text,
      title,
      userId
    });

    const slug = formatSlug(
      slugFormat,
      createdDate,
      article._key,
      sanitizedTitle
    );

    articles.update(article._key, {
      slug
    });

    res.status(200, `Article Created`);
  })
  .body(
    joi
      .object({
        articleTypeId: joi.string().required(),
        createdDate: joi.string().required(),
        sanitizedTitle: joi.string().required(),
        slugFormat: joi.string().required(),
        status: joi.string().required(),
        summary: joi.any(),
        text: joi.string().required(),
        title: joi.string().required(),
        userId: joi.string().required()
      })
      .required()
  )
  .summary('Create a article').description(dd`
  Creates a article
`);

router
  .put('/:_key', function (req, res) {
    if (!hasRole(req, 'articles_update')) {
      res.throw(401, `Unathorized`);
    }
    const {
      sanitizedTitle,
      slug,
      slugFormat,
      status,
      summary,
      text,
      title,
      updatedDate
    } = req.body;

    const { _key } = req.pathParams;

    if (articles.firstExample({ _key })) {
      articles.update(_key, {
        slug,
        status,
        summary,
        text,
        title,
        updatedDate
      });
      res.status(200, `Article Updated`);
    } else {
      res.throw(400, `Invalid Article Id: ${_key}`);
    }
  })
  .body(
    joi
      .object({
        sanitizedTitle: joi.string().required(),
        slug: joi.string().required(),
        slugFormat: joi.string().required(),
        status: joi.string().required(),
        summary: joi.any(),
        text: joi.string().required(),
        title: joi.string().required(),
        updatedDate: joi.string().required()
      })
      .required()
  )
  .pathParam('_key')
  .summary('Update article').description(dd`
  Updates article
`);

router
  .delete('/:_key', function (req, res) {
    if (!hasRole(req, 'articles_delete')) {
      res.throw(401, `Unathorized`);
    }

    const { _key } = req.pathParams;
    let article;
    let comment;

    try {
      article = db._query(aql`
        FOR article IN ${articles}
          FILTER article._key == ${_key}
          REMOVE article in ${articles}
      `);
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      throw e;
    }
    /*
    try {
      comment = db._query(aql`
        FOR comment IN ${comments}
          FILTER comment.topic == ${_key}
          REMOVE comment in ${comments}
      `);
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      throw e;
    }
    */
    res.status(200, `Article Deleted`);
  })
  .pathParam('_key')
  .summary('Delete article').description(dd`
  Deletes article
`);

router
  .get(
    '/type/:slug',
    function (req, res) {
      if (!hasRole(req, 'articles_view')) {
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

      let article;
      try {
        article = db._query(aql`
          FOR article IN ${articles}
            FILTER article.articleTypeId == ${articleType._key}
              FOR articleType in ${articleTypes}
                FILTER articleType._key == article.articleTypeId
              FOR user IN ${users}
                FILTER user._key == article.userId
            SORT article.createdDate DESC
            RETURN {
              "_key" : article._key,
              "articleType" : articleType,
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
  .pathParam('type')
  .summary('Fetch article').description(dd`
  Retrieves article
`);

router
  .get(
    '/:_key',
    function (req, res) {
      if (!hasRole(req, 'articles_view')) {
        res.throw(401, `Unathorized`);
      }
      const { _key } = req.pathParams;
      let article;
      try {
        article = db._query(aql`
        FOR article IN ${articles}
          FILTER article._key == ${_key}
            FOR articleType in ${articleTypes}
              FILTER article.articleTypeId == articleType._key
            FOR user IN ${users}
              FILTER user._key == article.userId
            RETURN {
              "_key" : article._key,
              "articleType" : articleType,
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
  .get(
    '/',
    function (req, res) {
      if (!hasRole(req, 'articles_view')) {
        res.throw(401, `Unathorized`);
      }

      let article;
      try {
        article = db._query(aql`
          FOR article IN ${articles}
            FOR articleType in ${articleTypes}
              FILTER articleType._key == article.articleTypeId
            FOR user IN ${users}
              FILTER user._key == article.userId
            SORT article.createdDate DESC
            RETURN {
              "_key" : article._key,
              "articleType" : articleType,
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
  .summary('Fetch article').description(dd`
  Retrieves article
`);

module.exports = router;
