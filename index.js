const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const app = express();
const PORT = 3000;
const db = require('./db');

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'client', 'public')));

app.get('/', authTokenMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});
app.get('/pages/login', redirectMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'login.html'));
});
app.get('/pages/register', redirectMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'register.html'));
});

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function isValidUser(user, token) {
  const [rows] = await db.query(
    `SELECT * FROM tokens WHERE username = ? AND token = ? AND expire > NOW()`,
    [user, token]
  );
  return rows.length > 0;
}

async function authTokenMiddleware(req, res, next) {
  const { user, token } = req.cookies;
  if (!user || !token || !(await isValidUser(user, token))) {
    return res.redirect('/pages/login');
  }
  next();
}
async function redirectMiddleware(req, res, next) {
  const { user, token } = req.cookies;
  if (await isValidUser(user, token)) {
    return res.redirect('/');
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
  //単位はmsで1時間
  const expire = new Date(Date.now() + 1000 * 60 * 60);
  await db.query(
    `INSERT INTO tokens (username, token, expire) VALUES (?, ?, ?)`,
    [user, token, expire]
  );
  res.cookie('user', user, { httpOnly: true });
  res.cookie('token', token, { httpOnly: true });
  next();
}

app.post(
  '/api/register',
  async (req, res, next) => {
    const { user, password, password_confirm } = req.body;

    if (!/^[a-z]{1,12}$/.test(user))
      return res.status(400).json({ error: 'Invalid username' });

    const [rows] = await db.query(`SELECT * FROM users WHERE username = ?`, [
      user,
    ]);
    if (rows.length > 0)
      return res.status(409).json({ error: 'Username already taken' });

    if (!/^\w{1,20}$/.test(password))
      return res.status(400).json({ error: 'Invalid password' });
    if (password !== password_confirm)
      return res.status(400).send({ error: 'Enter the same password' });

    const hash = sha256(password);
    await db.query(
      `INSERT INTO users (username, password_hash) VALUES (?, ?)`,
      [user, hash]
    );
    next();
  },
  loginMiddleware,
  (req, res) => res.status(200).json({ redirectTo: '/' })
);

app.post('/api/login', loginMiddleware, (req, res) => {
  res.status(200).json({ redirectTo: '/' });
});

app.post('/api/logout', authTokenMiddleware, async (req, res) => {
  const { user, token } = req.cookies;
  //ユーザー名とトークンが一致したものを削除
  await db.query(`DELETE FROM tokens WHERE username = ? AND token = ?`, [
    user,
    token,
  ]);
  res.clearCookie('user');
  res.clearCookie('token');
  res.redirect('/pages/login');
});

app.get('/api/posts', authTokenMiddleware, async (req, res) => {
  const loginUser = req.cookies.user;
  //enaフラグがTRUEのもののみ抽出
  const [rows] = await db.query(`SELECT * FROM posts WHERE ena = TRUE`);

  const me = [];
  const others = [];

  for (const row of rows) {
    if (row.username === loginUser) {
      me.push(row);
    } else {
      others.push(row);
    }
  }

  me.sort((a, b) => new Date(a.date) - new Date(b.date));

  others.sort((a, b) => {
    const diff = new Date(a.date) - new Date(b.date);
    //値が同じなら名前で比較
    if (diff !== 0) return diff;
    return a.username.localeCompare(b.username);
  });

  res.status(200).json(me.concat(others));
});

const isValidDate = (str) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/.test(str))
    return false;
  const date = new Date(str);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
};
const isValidTime = (start, end) => {
  const timeRegex = /^((([01][0-9]|2[0-3]):[0-5][0-9])|99:99)$/;
  if (!timeRegex.test(start) || !timeRegex.test(end)) return false;
  if (start == '99:99' || end == '99:99') return true;

  //数に変換して比較
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  return endHour * 60 + endMinute > startHour * 60 + startMinute ? 1 : 0;
};

app.post('/api/posts', authTokenMiddleware, async (req, res) => {
  //データ追加時はユーザー名は常にログイン中のユーザー
  const user = req.cookies.user;
  const { date, start, end, comment, original_date } = req.body;

  if (!isValidDate(date)) {
    return res.status(400).json({ error: 'Invalid Date' });
  }

  if (!isValidTime(start, end)) {
    return res.status(400).json({ error: 'Invalid Time' });
  }

  if (comment && comment.length > 500) {
    return res.status(400).json({ error: 'Comment Too Long' });
  }

  const [targetDateExist] = await db.query(
    `SELECT * FROM posts WHERE username = ? AND date = ?`,
    [user, date]
  );

  if (original_date) {
    //同じ日付の重複は許していないかつ編集ボタンを選択できているということはena=TRUEなので1つしかありえない。
    const [originalDateExist] = await db.query(
      `SELECT * FROM posts WHERE username=? AND date=?`,
      [user, original_date]
    );
    if (originalDateExist.length === 0)
      return res
        .status(403)
        .json({ error: 'You can only edit your own posts' });

    if (targetDateExist.length > 0) {
      await db.query(
        `UPDATE posts SET ena = FALSE WHERE username = ? AND date = ?`,
        [user, original_date]
      );
      await db.query(
        `UPDATE posts SET start=?,end=?,comment=?,ena=TRUE WHERE username=? AND date=?`,
        [start, end, comment, user, date]
      );
    } else {
      await db.query(
        `UPDATE posts SET date=?,start=?,end=?,comment=?,ena=TRUE WHERE username=? AND date=?`,
        [date, start, end, comment, user, original_date]
      );
    }
  } else {
    if (targetDateExist.length > 0) {
      //日付が一致したら出勤退勤時間コメントのみ更新+enaフラグをTRUEに
      await db.query(
        `UPDATE posts SET start = ?, end = ?, comment = ?,ena = TRUE WHERE username = ? AND date = ?`,
        [start, end, comment, user, date]
      );
    } else {
      //新規にレコード
      await db.query(
        `INSERT INTO posts (username, date, start, end, comment) VALUES (?, ?, ?, ?, ?)`,
        [user, date, start, end, comment]
      );
    }
  }
  res.status(200).json({ redirectTo: '/' });
});

app.post('/api/posts/delete', authTokenMiddleware, async (req, res) => {
  const loginUser = req.cookies.user;
  const { user, date } = req.body;
  if (loginUser !== user)
    return res
      .status(403)
      .json({ error: 'You can only delete your own posts' });
  //enaフラグをFALSEに
  await db.query(
    `UPDATE posts SET ena = FALSE WHERE username = ? AND date = ?`,
    [user, date]
  );
  res.sendStatus(200);
});

app.get('/api/user', authTokenMiddleware, (req, res) => {
  const { user } = req.cookies;
  res.json({ user });
});

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
