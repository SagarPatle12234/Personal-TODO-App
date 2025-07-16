const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize SQLite database
const db = new sqlite3.Database('./todo_app.db');

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Todo lists table
  db.run(`CREATE TABLE IF NOT EXISTS todo_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Tasks table
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_list_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (todo_list_id) REFERENCES todo_lists (id)
  )`);
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// User registration
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }
        
        const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET);
        res.json({ token, user: { id: this.lastID, username, email } });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// User login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      try {
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
        res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
      } catch (error) {
        res.status(500).json({ error: 'Server error' });
      }
    }
  );
});

// Get all todo lists for authenticated user
app.get('/api/todolists', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM todo_lists WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id],
    (err, lists) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(lists);
    }
  );
});

// Create new todo list
app.post('/api/todolists', authenticateToken, (req, res) => {
  const { title, description } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  db.run(
    'INSERT INTO todo_lists (user_id, title, description) VALUES (?, ?, ?)',
    [req.user.id, title, description || ''],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      db.get(
        'SELECT * FROM todo_lists WHERE id = ?',
        [this.lastID],
        (err, list) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          res.json(list);
        }
      );
    }
  );
});

// Get specific todo list with tasks
app.get('/api/todolists/:id', authenticateToken, (req, res) => {
  const listId = req.params.id;
  
  db.get(
    'SELECT * FROM todo_lists WHERE id = ? AND user_id = ?',
    [listId, req.user.id],
    (err, list) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!list) {
        return res.status(404).json({ error: 'Todo list not found' });
      }

      db.all(
        'SELECT * FROM tasks WHERE todo_list_id = ? ORDER BY created_at DESC',
        [listId],
        (err, tasks) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          res.json({ ...list, tasks });
        }
      );
    }
  );
});

// Add task to todo list
app.post('/api/todolists/:id/tasks', authenticateToken, (req, res) => {
  const listId = req.params.id;
  const { title, description } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Task title is required' });
  }

  // Verify the todo list belongs to the user
  db.get(
    'SELECT * FROM todo_lists WHERE id = ? AND user_id = ?',
    [listId, req.user.id],
    (err, list) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!list) {
        return res.status(404).json({ error: 'Todo list not found' });
      }

      db.run(
        'INSERT INTO tasks (todo_list_id, title, description) VALUES (?, ?, ?)',
        [listId, title, description || ''],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          db.get(
            'SELECT * FROM tasks WHERE id = ?',
            [this.lastID],
            (err, task) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }
              res.json(task);
            }
          );
        }
      );
    }
  );
});

// Toggle task completion
app.put('/api/tasks/:id/toggle', authenticateToken, (req, res) => {
  const taskId = req.params.id;
  
  db.run(
    `UPDATE tasks SET completed = NOT completed 
     WHERE id = ? AND todo_list_id IN (
       SELECT id FROM todo_lists WHERE user_id = ?
     )`,
    [taskId, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      db.get(
        'SELECT * FROM tasks WHERE id = ?',
        [taskId],
        (err, task) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          res.json(task);
        }
      );
    }
  );
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
