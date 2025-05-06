const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const app = express();
const PORT = 3000;
const db = require('./db');

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use('/app.js', express.static(path.join(__dirname, 'public', 'app.js')));

app.get('/', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/pages/login', autoRedirectMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/pages/register', autoRedirectMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function isValidToken(user, token) {
  const [rows] = await db.query(
    `SELECT * FROM tokens WHERE username = ? AND token = ? AND expires_at > NOW()`,
    [user, token]
  );
  return rows.length > 0;
}
//トークン検証
async function authMiddleware(req, res, next) {
  const { user, token } = req.cookies;
  if (!user || !token || !(await isValidToken(user, token))) {
    return res.redirect('/pages/login');
  }
  next();
}
async function autoRedirectMiddleware(req, res, next) {
  const { user, token } = req.cookies;
  if (await isValidToken(user, token)) {
    res.redirect('/');
  }
  next();
}

async function loginMiddleware(req, res, next) {
  const { user, password } = req.body;
  const hash = sha256(password);
  const [rows] = await db.query(
    `SELECT * FROM users WHERE username = ? AND password_hash = ?`,
    [user, hash]
  );
  if (rows.length === 0)
    return res.status(401).json({
      error: 'Username or Password is Invalid',
    });

  const token = crypto.randomBytes(32).toString('hex');
  //単位は10^-3
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
  await db.query(
    `INSERT INTO tokens (username, token, expires_at) VALUES (?, ?, ?)`,
    [user, token, expiresAt]
  );
  res.cookie('user', user, { httpOnly: true });
  res.cookie('token', token, { httpOnly: true });
  res.redirect('/');
  next();
}
app.post(
  '/api/register',
  async (req, res, next) => {
    const { user, password } = req.body;

    if (!/^[a-z]+$/.test(user)) {
      return res.status(400).json({ error: 'Invalid username' });
    }

    const [rows] = await db.query(`SELECT * FROM users WHERE username = ?`, [
      user,
    ]);
    if (rows.length > 0)
      return res.status(409).json({ error: 'Username already taken' });

    const hash = sha256(password);
    await db.query(
      `INSERT INTO users (username, password_hash) VALUES (?, ?)`,
      [user, hash]
    );
    next();
  },
  loginMiddleware
);

//パスワードが一致したらトークン生成
//TODO:出勤時間と退勤時間が反転していないかバリデーション
app.post('/api/login', loginMiddleware);

//トークンが一致したらトークンファイルからその行を削除し、クライアントのクッキーもクリアする。
//アカウント削除ではないのでユーザーファイルはいじらない。
app.post('/api/logout', authMiddleware, async (req, res) => {
  const { user, token } = req.cookies;
  await db.query(`DELETE FROM tokens WHERE username = ? AND token = ?`, [
    user,
    token,
  ]);
  res.clearCookie('user');
  res.clearCookie('token');
  res.redirect('/pages/login');
});

app.get('/api/posts', authMiddleware, async (req, res) => {
  const loginUser = req.cookies.user;
  const [rows] = await db.query(
    `SELECT * FROM posts WHERE ena = TRUE ORDER BY date ASC, username ASC`
  );

  rows.sort((a, b) =>
    a.username === loginUser ? -1 : b.username === loginUser ? 1 : 0
  );
  res.json(rows);
});

app.post('/api/posts', authMiddleware, async (req, res) => {
  const user = req.cookies.user;
  const { date, start, end, comment } = req.body;

  const [existing] = await db.query(
    `SELECT * FROM posts WHERE username = ? AND date = ?`,
    [user, date]
  );

  if (existing.length > 0) {
    await db.query(
      `UPDATE posts SET start = ?, end = ?, comment = ? WHERE username = ? AND date = ?`,
      [start, end, comment, user, date]
    );
  } else {
    await db.query(
      `INSERT INTO posts (username, date, start, end, comment) VALUES (?, ?, ?, ?, ?)`,
      [user, date, start, end, comment]
    );
  }
  res.redirect('/');
});

app.post('/api/posts/delete', authMiddleware, async (req, res) => {
  const { user, date } = req.body;
  await db.query(
    `UPDATE posts SET ena = FALSE WHERE username = ? AND date = ?`,
    [user, date]
  );
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log('Hello World');
});
