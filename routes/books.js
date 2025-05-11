const express = require('express');
const { Op } = require('sequelize');
const { protect } = require('../middleware/auth');
const { Book } = require('../models/Book');
const { User } = require('../models/User');

const router = express.Router();

// Constants for publishing limits
const MAX_BOOKS_PER_DAY = 2;
const MIN_CHARACTER_COUNT = 5000;
const BANNED_TITLE_PHRASES = [
  "READ THIS NOW!",
  "You won't believe...",
  "Shocking secret",
  "This will blow your mind",
  "Must read!",
  "What happens next will shock you",
  "Top 10 reasons",
  "The ultimate guide",
  "Don't miss this",
  "Guaranteed results",
  "Click here",
  "Buy now",
  "MUST READ THIS NOW!",
  "FREE GIFT",
  "Limited time offer",
  "Act fast",
  "Last chance",
  "Exclusive deal",
  "Unbelievable offer",
];

// PUBLIC ROUTES

// Get publish limit info
router.get('/publish-limit', protect, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await Book.count({
      where: {
        userId: req.user.id,
        publishedAt: {
          [Op.gte]: twentyFourHoursAgo
        }
      }
    });
    
    res.json({
      count,
      remaining: Math.max(0, MAX_BOOKS_PER_DAY - count),
      limit: MAX_BOOKS_PER_DAY
    });
  } catch (error) {
    console.error('Publish limit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get published books for discovery
router.get('/discover', async (req, res) => {
  try {
    const { genre, search, author } = req.query;
    const where = { 
      isPublished: true,
      isDeleted: false
    };
    
    if (author) where.userId = author;
    
    if (genre) {
      where.genre = {
        [Op.contains]: [genre]
      };
    }
    
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { tags: { [Op.contains]: [search] } }
      ];
    }
    
    const books = await Book.findAll({
      where,
      include: [{
        model: User,
        attributes: ['id', 'username', 'avatarUrl']
      }],
      order: [['publishedAt', 'DESC']]
    });
    
    res.json(books);
  } catch (error) {
    console.error('Discover books error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single published book
router.get('/public/:id', async (req, res) => {
  try {
    const book = await Book.findOne({
      where: { 
        id: req.params.id,
        isPublished: true,
        isDeleted: false
      },
      include: [{
        model: User,
        attributes: ['id', 'username', 'avatarUrl', 'bio']
      }]
    });
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found or not published' });
    }
    
    res.json(book);
  } catch (error) {
    console.error('Get public book error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PROTECTED ROUTES

// Create a new book
router.post('/', protect, async (req, res) => {
  try {
    const { title, description } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }
    
    const book = await Book.create({
      userId: req.user.id,
      title,
      description,
      content: ''
    });
    
    res.status(201).json(book);
  } catch (error) {
    console.error('Create book error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all books for current user
router.get('/my-books', protect, async (req, res) => {
  try {
    const { includeDeleted } = req.query;
    const where = { userId: req.user.id };
    
    if (!includeDeleted || includeDeleted !== 'true') {
      where.isDeleted = false;
    }
    
    const books = await Book.findAll({
      where,
      order: [['lastSavedAt', 'DESC']]
    });
    
    res.json(books);
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single book
router.get('/:id', protect, async (req, res) => {
  try {
    const book = await Book.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    res.json(book);
  } catch (error) {
    console.error('Get book error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a book (for autosave)
router.put('/:id', protect, async (req, res) => {
  try {
    const { content, title, description } = req.body;
    
    const book = await Book.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id,
        isDeleted: false
      }
    });
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found or already deleted' });
    }
    
    if (content !== undefined) book.content = content;
    if (title !== undefined) book.title = title;
    if (description !== undefined) book.description = description;
    
    book.lastSavedAt = new Date();
    await book.save();
    
    res.json(book);
  } catch (error) {
    console.error('Update book error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Publish a book
router.put('/:id/publish', protect, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      content,
      subtitle, 
      synopsis, 
      genre, 
      tags, 
      coverImage, 
      language, 
      license,
      isMonetized,
      price
    } = req.body;
    
    // Check for banned title phrases
    const hasBannedTitle = BANNED_TITLE_PHRASES.some(phrase => 
      title.toLowerCase().includes(phrase.toLowerCase())
    );
    
    if (hasBannedTitle) {
      return res.status(400).json({ 
        message: 'Title contains phrases that are not allowed' 
      });
    }
    
    // Check character count
    if (content.length < MIN_CHARACTER_COUNT) {
      return res.status(400).json({ 
        message: `Book must be at least ${MIN_CHARACTER_COUNT} characters long` 
      });
    }
    
    // Check publishing limit
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentPublishes = await Book.count({
      where: {
        userId: req.user.id,
        publishedAt: {
          [Op.gte]: twentyFourHoursAgo
        }
      }
    });
    
    if (recentPublishes >= MAX_BOOKS_PER_DAY) {
      return res.status(429).json({ 
        message: `You can only publish ${MAX_BOOKS_PER_DAY} books per 24 hours` 
      });
    }
    
    const book = await Book.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id,
        isDeleted: false
      }
    });
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found or already deleted' });
    }
    
    // Validate required fields
    if (!title || !description || !genre || genre.length === 0) {
      return res.status(400).json({ message: 'Title, description and at least one genre are required' });
    }
    
    // Update book details
    book.title = title;
    book.description = description;
    book.content = content;
    book.subtitle = subtitle || null;
    book.synopsis = synopsis || null;
    book.genre = genre;
    book.tags = tags || [];
    book.coverImage = coverImage || null;
    book.language = language || 'English';
    book.license = license || 'All rights reserved';
    book.isMonetized = isMonetized || false;
    book.price = isMonetized ? price : null;
    book.isPublished = true;
    book.publishedAt = new Date();
    book.lastSavedAt = new Date();
    
    await book.save();
    
    res.json(book);
  } catch (error) {
    console.error('Publish book error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Soft delete a book
router.delete('/:id', protect, async (req, res) => {
  try {
    const book = await Book.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id,
        isDeleted: false
      }
    });
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found or already deleted' });
    }
    
    // Set up soft deletion
    const now = new Date();
    const tenDaysFromNow = new Date(now);
    tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
    
    book.isDeleted = true;
    book.deletedAt = now;
    book.scheduledForDeletionAt = tenDaysFromNow;
    
    await book.save();
    
    res.json({ 
      message: 'Book has been scheduled for deletion and will be permanently removed in 10 days',
      deletedAt: now,
      scheduledForDeletionAt: tenDaysFromNow
    });
  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all published books by a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const books = await Book.findAll({
      where: { 
        userId: req.params.userId,
        isPublished: true,
        isDeleted: false
      },
      include: [{
        model: User,
        attributes: ['id', 'username', 'avatarUrl']
      }],
      order: [['publishedAt', 'DESC']]
    });
    
    res.json(books);
  } catch (error) {
    console.error('Get user books error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Restore a soft-deleted book
router.post('/:id/restore', protect, async (req, res) => {
  try {
    const book = await Book.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id,
        isDeleted: true
      }
    });
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found or not in deleted state' });
    }
    
    // Restore the book
    book.isDeleted = false;
    book.deletedAt = null;
    book.scheduledForDeletionAt = null;
    
    await book.save();
    
    res.json({ 
      message: 'Book has been restored successfully',
      book
    });
  } catch (error) {
    console.error('Restore book error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;