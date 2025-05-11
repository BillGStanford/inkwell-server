// routes/bookmarks.js
const express = require('express');
const { protect } = require('../middleware/auth');
const { Bookmark } = require('../models/Bookmark');
const { Book } = require('../models/Book');
const { User } = require('../models/User'); // Add this missing import

const router = express.Router();

// Get all bookmarks for user
router.get('/', protect, async (req, res) => {
  try {
    const bookmarks = await Bookmark.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Book,
        include: [{
          model: User,
          attributes: ['id', 'username', 'avatarUrl']
        }]
      }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(bookmarks);
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add bookmark
router.post('/', protect, async (req, res) => {
  try {
    const { bookId, pageIndex } = req.body;
    
    if (!bookId) {
      return res.status(400).json({ message: 'Book ID is required' });
    }
    
    // Check if book exists
    const book = await Book.findOne({
      where: { 
        id: bookId,
        isPublished: true,
        isDeleted: false
      }
    });
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    // Check if bookmark already exists
    const existingBookmark = await Bookmark.findOne({
      where: { 
        userId: req.user.id,
        bookId,
        pageIndex: pageIndex || null
      }
    });
    
    if (existingBookmark) {
      return res.status(400).json({ message: 'Bookmark already exists' });
    }
    
    const bookmark = await Bookmark.create({
      userId: req.user.id,
      bookId,
      pageIndex: pageIndex || null,
      type: pageIndex !== undefined ? 'page' : 'book'
    });
    
    res.status(201).json(bookmark);
  } catch (error) {
    console.error('Add bookmark error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove bookmark
router.delete('/:id', protect, async (req, res) => {
  try {
    const bookmark = await Bookmark.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!bookmark) {
      return res.status(404).json({ message: 'Bookmark not found' });
    }
    
    await bookmark.destroy();
    
    res.json({ message: 'Bookmark removed successfully' });
  } catch (error) {
    console.error('Remove bookmark error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;