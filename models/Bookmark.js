const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/config');
const { User } = require('./User');
const { Book } = require('./Book');

const Bookmark = sequelize.define('Bookmark', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  bookId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Book,
      key: 'id'
    }
  },
  pageIndex: {
    type: DataTypes.INTEGER,
    allowNull: true // null means the whole book is bookmarked
  },
  type: {
    type: DataTypes.ENUM('book', 'page'),
    allowNull: false
  }
});

User.hasMany(Bookmark, { foreignKey: 'userId' });
Bookmark.belongsTo(User, { foreignKey: 'userId' });
Book.hasMany(Bookmark, { foreignKey: 'bookId' });
Bookmark.belongsTo(Book, { foreignKey: 'bookId' });

module.exports = { Bookmark };