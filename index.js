const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const PORT = 3000;
const POSTS_FILE = path.join(__dirname, "posts.txt");

app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

//ポスト内容の読み込みから保存まで
app.post('/posts', (req, res) => {
    const { user, date, start, end, comment } = req.body;
    if (!/^[a-z]+$/.test(user)) {
        return res.status(400).json({ error: "Invalid username" });
    }
    const entry = JSON.stringify({ user, date, start, end, comment }) + '\n';
    fs.appendFile(POSTS_FILE, entry, err => {
        if (err) return res.status(500).json({ error: 'Failed to save posts' });
       res.redirect('/');
    });
});

app.get('/posts', (req, res) => {

    const lines = fs.readFileSync(POSTS_FILE, 'utf8').trim().split('\n');
    const posts = lines.map(line =>JSON.parse(line));
    res.json(posts);
 });

app.listen(PORT, () => { console.log("Hello World") });
