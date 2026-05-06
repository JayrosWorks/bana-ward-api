const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());

// ===== ROUTES =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vitals', require('./routes/vitals'));
app.use('/api/nutrition', require('./routes/nutrition'));
app.use('/api/timeline', require('./routes/timeline'));
app.use('/api/billing', require('./routes/billing'));

// ===== TEST ROUTE =====
app.get('/', (req, res) => {
  res.json({ message: 'Bana Ward API is running!' });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bana Ward API running on port ${PORT}`);
});