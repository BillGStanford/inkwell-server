// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./db/config');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const bookRoutes = require('./routes/books');
const bookmarkRoutes = require('./routes/bookmarks');
const cron = require('node-cron');
const { cleanupDeletedBooks } = require('./scripts/cleanupDeletedBooks');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/bookmarks', bookmarkRoutes);

// Base route
app.get('/', (req, res) => {
  res.send('INKWELL API is running');
});

// Scheduled cleanup task
cron.schedule('0 0 * * *', async () => {
  console.log('Running scheduled cleanup of deleted books...');
  try {
    await cleanupDeletedBooks();
    console.log('Scheduled cleanup completed successfully');
  } catch (error) {
    console.error('Scheduled cleanup failed:', error);
  }
});

// Initial cleanup on server start
cleanupDeletedBooks().catch(err => {
  console.error('Initial cleanup failed:', err);
});

// Database connection and server startup
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    await sequelize.sync({ alter: true });
    console.log('Database models synchronized');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

startServer();