const express = require('express');
const db = require('./db');
const bcrypt = require('bcrypt');
const multer = require('multer');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = 3000;
const SECRET = 'your-secret-key'; // Change in production

app.use(cors());
app.use(express.json());
app.use(express.static('uploads')); // Serve uploaded images
app.use(express.static('.')); // Serve static files like index.html

const upload = multer({ dest: 'uploads/' });

// Middleware to verify token
function authenticate(req, res, next) {
    const token = req.headers.authorization;
    if (!token) return res.status(401).send('Unauthorized');
    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.status(403).send('Forbidden');
        req.user = user;
        next();
    });
}

// Auth routes
app.post('/signup', upload.single('profileImage'), async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send('Missing fields');
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const profileImage = req.file ? req.file.path : null;
        db.run('INSERT INTO users (username, password, profile_image) VALUES (?, ?, ?)', [username, hashedPassword, profileImage], function(err) {
            if (err) return res.status(400).send('User exists or error');
            res.send('Signed up');
        });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user || !(await bcrypt.compare(password, user.password))) return res.status(401).send('Invalid credentials');
        const token = jwt.sign({ id: user.id, username }, SECRET);
        res.json({ token, user: username });
    });
});

// Posts
app.get('/posts', authenticate, (req, res) => {
    db.all('SELECT posts.*, users.username, users.profile_image FROM posts JOIN users ON posts.user_id = users.id ORDER BY posts.id DESC', [], (err, rows) => {
        if (err) return res.status(500).send('Error');
        res.json(rows);
    });
});

app.post('/posts', authenticate, upload.single('image'), (req, res) => {
    const { text } = req.body;
    const image = req.file ? req.file.path : null;
    db.run('INSERT INTO posts (user_id, text, image) VALUES (?, ?, ?)', [req.user.id, text, image], () => res.send('Posted'));
});

app.post('/posts/:id/like', authenticate, (req, res) => {
    db.run('UPDATE posts SET likes = likes + 1 WHERE id = ?', [req.params.id], () => res.send('Liked'));
});

app.post('/posts/:id/comment', authenticate, (req, res) => {
    const { comment } = req.body;
    db.run('INSERT INTO comments (post_id, user_id, text) VALUES (?, ?, ?)', [req.params.id, req.user.id, comment], () => res.send('Commented'));
});

// Friend requests
app.post('/friend-request', authenticate, (req, res) => {
    const { friend } = req.body;
    db.get('SELECT id FROM users WHERE username = ?', [friend], (err, user) => {
        if (!user) return res.status(404).send('User not found');
        db.run('INSERT INTO friend_requests (from_user_id, to_user_id) VALUES (?, ?)', [req.user.id, user.id], () => res.send('Request sent'));
    });
});

app.get('/friend-requests', authenticate, (req, res) => {
    db.all('SELECT fr.id, u.username AS from FROM friend_requests fr JOIN users u ON fr.from_user_id = u.id WHERE fr.to_user_id = ? AND fr.status = "pending"', [req.user.id], (err, rows) => {
        res.json(rows);
    });
});

app.post('/friend-request/:id/accept', authenticate, (req, res) => {
    db.run('UPDATE friend_requests SET status = "accepted" WHERE id = ? AND to_user_id = ?', [req.params.id, req.user.id], function() {
        if (this.changes > 0) {
            db.get('SELECT from_user_id FROM friend_requests WHERE id = ?', [req.params.id], (err, reqRow) => {
                db.run('INSERT INTO friends (user_id, friend_id) VALUES (?, ?)', [req.user.id, reqRow.from_user_id]);
                db.run('INSERT INTO friends (user_id, friend_id) VALUES (?, ?)', [reqRow.from_user_id, req.user.id]);
                res.send('Accepted');
            });
        } else {
            res.status(400).send('Not found');
        }
    });
});

app.post('/friend-request/:id/decline', authenticate, (req, res) => {
    db.run('UPDATE friend_requests SET status = "declined" WHERE id = ? AND to_user_id = ?', [req.params.id, req.user.id], () => res.send('Declined'));
});

// Friends
app.get('/friends', authenticate, (req, res) => {
    db.all('SELECT u.username, u.profile_image FROM friends f JOIN users u ON f.friend_id = u.id WHERE f.user_id = ?', [req.user.id], (err, rows) => {
        res.json(rows);
    });
});

// Messages
app.post('/messages', authenticate, upload.single('image'), (req, res) => {
    const { to, text } = req.body;
    const image = req.file ? req.file.path : null;
    db.get('SELECT id FROM users WHERE username = ?', [to], (err, user) => {
        if (!user) return res.status(404).send('User not found');
        db.run('INSERT INTO messages (from_user_id, to_user_id, text, image) VALUES (?, ?, ?, ?)', [req.user.id, user.id, text, image], () => res.send('Sent'));
    });
});

app.get('/messages/:friend', authenticate, (req, res) => {
    db.get('SELECT id FROM users WHERE username = ?', [req.params.friend], (err, user) => {
        if (!user) return res.status(404).send('User not found');
        db.all('SELECT m.text, m.image, u.username AS from FROM messages m JOIN users u ON m.from_user_id = u.id WHERE (m.from_user_id = ? AND m.to_user_id = ?) OR (m.from_user_id = ? AND m.to_user_id = ?) ORDER BY m.id', [req.user.id, user.id, user.id, req.user.id], (err, rows) => {
            res.json(rows);
        });
    });
});

app.get('/messages/check', authenticate, (req, res) => {
    // Simple check for new messages (in production, use WebSockets)
    db.all('SELECT COUNT(*) as count FROM messages WHERE to_user_id = ? AND id > (SELECT COALESCE(MAX(id), 0) FROM messages WHERE from_user_id = ?)', [req.user.id, req.user.id], (err, rows) => {
        res.json(rows[0]);
    });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));