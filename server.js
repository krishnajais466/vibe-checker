require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Universal CORS enables Live Server (port 5500) to communicate without blocking
app.use(cors({ origin: true, credentials: true }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/auth/register', (req, res) => {
  const { username, password, referralCode } = req.body;
  if (!username || !password || password.length < 4) {
    return res.status(400).json({ error: 'Username and minimum 4-character password required.' });
  }
  const result = db.registerUser(username, password, referralCode);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter your username and password.' });
  }
  const result = db.loginUser(username, password);
  if (result.error) return res.status(401).json(result);
  res.json(result);
});

app.post('/api/quiz/create', (req, res) => {
  const { userId, creatorName, questions } = req.body;
  if (!creatorName || !questions || questions.length === 0) {
    return res.status(400).json({ error: 'Incomplete quiz data.' });
  }
  const result = db.createQuiz(userId || 'ANON', creatorName, questions);
  res.json(result);
});

app.get('/api/quiz/:id', (req, res) => {
  const result = db.getQuizForTaker(req.params.id);
  if (!result) return res.status(404).json({ error: 'Quiz link is invalid or expired.' });
  res.json(result);
});

app.post('/api/quiz/match', (req, res) => {
  const { quizId, takerName, answers } = req.body;
  if (!quizId || !takerName || !answers) {
    return res.status(400).json({ error: 'Missing attempt responses.' });
  }
  const result = db.calculateVibeMatch(quizId, takerName, answers);
  if (!result) return res.status(404).json({ error: 'Quiz not found.' });
  res.json({ success: true, match: result });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server live on http://127.0.0.1:${PORT}`);
});