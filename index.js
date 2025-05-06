const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const app = express();
const PORT = 3000;

const USERS_FILE = path.join(__dirname, 'users.txt');
const TOKENS_FILE = path.join(__dirname, 'tokens.txt');
const POSTS_FILE = path.join(__dirname, 'posts.txt');

app.use(express.json());
app.use(cookieParser());
// 静的ファイル（CSSやJS）は誰でも見れるようにしておく
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pages/login', express.static(path.join(__dirname,'public','login.html')));
app.use(express.urlencoded({ extended: true }));

function isValidToken(user, token) {
    if (!fs.existsSync(TOKENS_FILE)) return (false);
    const lines = fs.readFileSync(TOKENS_FILE, 'utf8').trim().split('\n');
    return lines.some(line => {
        const [u, t] = line.split(':');
        return u === user && t === token;
    });
}
//トークン検証
function authMiddleware(req, res, next) {
    const { user, token } = req.cookies;
    if (!user || !token || !isValidToken(user, token)) {
        return res.redirect('/pages/login');
    }
    next();
}

// index.html の表示はログイン必須にする
app.get('/', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


//パスワードが一致したらトークン生成
//TODO:既にログインしている場合はホームリダイレクト
app.post('/api/login', (req, res) => {
    const { user, password } = req.body;
    if (!fs.existsSync(USERS_FILE)) return res.status(401).json({ error: 'No user' });
    const lines = fs.readFileSync(USERS_FILE, 'utf8').trim().split('\n');
    const isUser = lines.some(line => {
        const [u, p] = line.split(':');
        return u === user && p === password;
    });
    if (!isUser) return res.status(401).json({
        error: 'Username or Password is Invalid'
    });
    const token = crypto.randomBytes(16).toString('hex');
    fs.appendFileSync(TOKENS_FILE, `${user}:${token}\n`);
    res.cookie('user', user, { httpOnly: true });
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/');
})

//トークンが一致したらトークンファイルからその行を削除し、クライアントのクッキーもクリアする。
//アカウント削除ではないのでユーザーファイルはいじらない。
app.post('/api/logout', (req, res) => {
    const { user, token } = req.cookies;
    if (fs.existsSync(TOKENS_FILE)) {
        const lines = fs.readFileSync(TOKENS_FILE, 'utf8').trim().split('\n');
        const updated = lines.filter(line=>line!==`${user}:${token}`);
        fs.writeFileSync(TOKENS_FILE, updated.join('\n') + '\n');
    }
    res.clearCookie('user');
    res.clearCookie('token');
    res.redirect('/pages/login');
});

app.post('/api/posts',authMiddleware, (req, res) => {
    const { user, date, start, end, comment } = req.body;
    if (!/^[a-z]+$/.test(user)) {
        return res.status(400).json({ error: 'Invalid username' });
    }
    const entry = JSON.stringify({ user, date, start, end, comment }) + '\n';
    fs.appendFile(POSTS_FILE, entry, err => {
        if (err) return res.status(500).json({ error: 'Failed to save posts' });
       res.redirect('/');
    });
});

app.get('/api/posts',authMiddleware, (req, res) => {
    const lines = fs.readFileSync(POSTS_FILE, 'utf8').trim().split('\n');
    const posts = lines.map(line =>JSON.parse(line));
    res.json(posts);
 });


app.listen(PORT, () => { console.log('Hello World') });
