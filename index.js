'use strict';

module.context.use('/content', require('./routes/content'), 'content');
module.context.use('/type', require('./routes/type'), 'type');
module.context.use('/types', require('./routes/types'), 'types');
