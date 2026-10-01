const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, 'vibecheck_data.json');

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users: [],
    quizzes: [],
    questions: [],
    attempts: [],
    referrals: []
  }, null, 2));
}

function readData() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { users: [], quizzes: [], questions: [], attempts: [], referrals: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = {
  registerUser(username, password, referralCode) {
    const data = readData();
    const cleanUser = username.trim().toLowerCase();
    
    if (data.users.find(u => u.username.toLowerCase() === cleanUser)) {
      return { error: 'Username already taken.' };
    }

    const myReferralCode = 'REF-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const newUser = {
      id: 'USR-' + Date.now(),
      username: cleanUser,
      displayName: username.trim(),
      passwordHash: hashPassword(password),
      referralCode: myReferralCode,
      referredBy: referralCode || null,
      referralCount: 0,
      createdAt: new Date().toISOString()
    };

    if (referralCode) {
      const referrer = data.users.find(u => u.referralCode === referralCode.trim().toUpperCase());
      if (referrer) {
        referrer.referralCount = (referrer.referralCount || 0) + 1;
        data.referrals.push({
          referrerId: referrer.id,
          newUserId: newUser.id,
          timestamp: new Date().toISOString()
        });
      }
    }

    data.users.push(newUser);
    writeData(data);

    return { 
      success: true, 
      user: { id: newUser.id, username: newUser.displayName, referralCode: newUser.referralCode, referralCount: newUser.referralCount }
    };
  },

  loginUser(username, password) {
    const data = readData();
    const cleanUser = username.trim().toLowerCase();
    const user = data.users.find(u => u.username.toLowerCase() === cleanUser);

    if (!user || user.passwordHash !== hashPassword(password)) {
      return { error: 'Invalid username or password.' };
    }

    return {
      success: true,
      user: { id: user.id, username: user.displayName, referralCode: user.referralCode, referralCount: user.referralCount || 0 }
    };
  },

  createQuiz(userId, creatorName, questionsList) {
    const data = readData();
    const quizId = 'VIBE-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    data.quizzes.push({
      id: quizId,
      userId,
      creatorName,
      createdAt: new Date().toISOString()
    });

    questionsList.forEach((q, idx) => {
      data.questions.push({
        id: `${quizId}_Q${idx + 1}`,
        quizId,
        category: q.category,
        questionText: q.questionText,
        options: q.options,
        creatorChoice: q.choice
      });
    });

    writeData(data);
    return { success: true, quizId };
  },

  getQuizForTaker(quizId) {
    const data = readData();
    const quiz = data.quizzes.find(q => q.id === quizId);
    if (!quiz) return null;

    const questions = data.questions
      .filter(q => q.quizId === quizId)
      .map(q => ({
        id: q.id,
        category: q.category,
        questionText: q.questionText,
        options: q.options
      }));

    return { quiz, questions };
  },

  calculateVibeMatch(quizId, takerName, takerAnswers) {
    const data = readData();
    const quiz = data.quizzes.find(q => q.id === quizId);
    if (!quiz) return null;

    const originalQuestions = data.questions.filter(q => q.quizId === quizId);
    let matches = 0;
    const comparisons = [];

    originalQuestions.forEach(orig => {
      const takerAns = takerAnswers.find(a => a.questionId === orig.id);
      const chosen = takerAns ? takerAns.choice : '';
      const isMatch = chosen.trim().toLowerCase() === orig.creatorChoice.trim().toLowerCase();
      
      if (isMatch) matches++;

      comparisons.push({
        category: orig.category,
        questionText: orig.questionText,
        creatorChoice: orig.creatorChoice,
        takerChoice: chosen,
        isMatch
      });
    });

    const total = originalQuestions.length;
    const scorePct = total > 0 ? Math.round((matches / total) * 100) : 0;

    const attempt = {
      id: 'ATT-' + Date.now(),
      quizId,
      takerName,
      scorePercentage: scorePct,
      matches,
      total,
      comparisons,
      submittedAt: new Date().toISOString()
    };

    data.attempts.push(attempt);
    writeData(data);

    return {
      takerName,
      creatorName: quiz.creatorName,
      scorePercentage: scorePct,
      matches,
      total,
      comparisons
    };
  }
};