// scripts/cleanupDeletedBooks.js
const { Book } = require('../models/Book');
const { Op } = require('sequelize');

/**
 * Script to permanently delete books that have passed their scheduled deletion date
 * This should be run as a scheduled task (e.g., with node-cron or a similar scheduler)
 */
async function cleanupDeletedBooks() {
  try {
    const now = new Date();
    
    // Find all books scheduled for deletion before now
    const booksToDelete = await Book.findAll({
      where: {
        isDeleted: true,
        scheduledForDeletionAt: {
          [Op.lt]: now // Less than current time
        }
      }
    });
    
    console.log(`Found ${booksToDelete.length} books to permanently delete`);
    
    // Permanently delete each book
    for (const book of booksToDelete) {
      console.log(`Permanently deleting book: ${book.id} - ${book.title}`);
      await book.destroy();
    }
    
    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// If running this script directly
if (require.main === module) {
  cleanupDeletedBooks()
    .then(() => {
      console.log('Cleanup script finished execution');
      process.exit(0);
    })
    .catch(err => {
      console.error('Cleanup script failed:', err);
      process.exit(1);
    });
}

module.exports = { cleanupDeletedBooks };