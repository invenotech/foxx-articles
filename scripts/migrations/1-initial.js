'use strict';

const { db } = require('@arangodb');

const hasPrivilege = db._collection('hasPrivilege');
const privileges = db._collection('privileges');
const roles = db._collection('roles');

/**
 * Initial Collection Setup
 */

if (!db._collection('articles')) {
  db._createDocumentCollection('articles');
}

if (!db._collection('articleCategories')) {
  db._createDocumentCollection('articleCategories');
}

if (!db._collection('articleTags')) {
  db._createDocumentCollection('articleTags');
}

if (!db._collection('articleTypes')) {
  db._createDocumentCollection('articleTypes');
}

if (!db._collection('articleHasCategory')) {
  db._createEdgeCollection('articleHasCategory');
}

if (!db._collection('articleHasTag')) {
  db._createEdgeCollection('articleHasTag');
}

const articleTypes = db._collection('articleTypes');

articleTypes.ensureIndex({
  type: 'hash',
  unique: true,
  fields: ['name']
});

/**
 * Privileges Setup
 */

const typePrivDelete = privileges.save({
  name: 'article_types_delete',
  description: 'Ability to delete Article Types'
});

const typePrivUpdate = privileges.save({
  name: 'article_types_update',
  description: 'Ability to update Article Types'
});

const typePrivView = privileges.save({
  name: 'article_types_view',
  description: 'Ability to view Article Types'
});

const privDelete = privileges.save({
  name: 'articles_delete',
  description: 'Ability to delete Articles'
});

const privUpdate = privileges.save({
  name: 'articles_update',
  description: 'Ability to update Articles'
});

const privView = privileges.save({
  name: 'articles_view',
  description: 'Ability to view Articles'
});

const adminRole = roles.firstExample({ name: 'admin' });

hasPrivilege.save({
  _to: `${adminRole._id}`,
  _from: `${typePrivDelete._id}`
});

hasPrivilege.save({
  _to: `${adminRole._id}`,
  _from: `${typePrivUpdate._id}`
});

hasPrivilege.save({
  _to: `${adminRole._id}`,
  _from: `${typePrivView._id}`
});

hasPrivilege.save({
  _to: `${adminRole._id}`,
  _from: `${privDelete._id}`
});

hasPrivilege.save({
  _to: `${adminRole._id}`,
  _from: `${privUpdate._id}`
});

hasPrivilege.save({
  _to: `${adminRole._id}`,
  _from: `${privView._id}`
});

module.exports = true;
