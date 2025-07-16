class TodoApp {
    constructor() {
        this.token = localStorage.getItem('token');
        this.currentUser = null;
        this.currentTodoList = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
    }

    setupEventListeners() {
        // Auth tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchAuthTab(tab);
            });
        });

        // Auth forms
        document.getElementById('login').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        document.getElementById('signup').addEventListener('submit', (e) => {
            e.preventDefault();
            this.signup();
        });

        // Dashboard
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        document.getElementById('create-new-btn').addEventListener('click', () => {
            this.showPage('create-page');
        });

        // Create todo form
        document.getElementById('create-todo-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createTodoList();
        });

        document.getElementById('cancel-create-btn').addEventListener('click', () => {
            this.showPage('dashboard-page');
        });

        // Todo detail page
        document.getElementById('back-to-dashboard').addEventListener('click', () => {
            this.showPage('dashboard-page');
            this.loadTodoLists();
        });

        document.getElementById('add-task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });
    }

    switchAuthTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`${tab}-form`).classList.add('active');
    }

    async login() {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.currentUser = data.user;
                localStorage.setItem('token', this.token);
                this.showMessage('Login successful!', 'success');
                this.showDashboard();
            } else {
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async signup() {
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.currentUser = data.user;
                localStorage.setItem('token', this.token);
                this.showMessage('Registration successful!', 'success');
                this.showDashboard();
            } else {
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    logout() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('token');
        this.showPage('auth-page');
    }

    checkAuth() {
        if (this.token) {
            this.showDashboard();
        } else {
            this.showPage('auth-page');
        }
    }

    showDashboard() {
        document.getElementById('username-display').textContent = this.currentUser?.username || 'User';
        this.showPage('dashboard-page');
        this.loadTodoLists();
    }

    async loadTodoLists() {
        try {
            const response = await fetch('/api/todolists', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            if (response.ok) {
                const todoLists = await response.json();
                this.renderTodoLists(todoLists);
            } else {
                this.showMessage('Failed to load todo lists', 'error');
            }
        } catch (error) {
            this.showMessage('Network error', 'error');
        }
    }

    renderTodoLists(todoLists) {
        const container = document.getElementById('todo-lists-container');
        
        if (todoLists.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No TODO lists yet</h3>
                    <p>Create your first TODO list to get started!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = todoLists.map(list => `
            <div class="todo-list-card" data-id="${list.id}">
                <h3>${list.title}</h3>
                <p>${list.description || 'No description'}</p>
                <div class="meta">
                    Created: ${new Date(list.created_at).toLocaleDateString()}
                </div>
            </div>
        `).join('');

        // Add click listeners to todo list cards
        document.querySelectorAll('.todo-list-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const listId = e.currentTarget.dataset.id;
                this.loadTodoDetail(listId);
            });
        });
    }

    async createTodoList() {
        const title = document.getElementById('todo-title').value;
        const description = document.getElementById('todo-description').value;

        try {
            const response = await fetch('/api/todolists', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                body: JSON.stringify({ title, description }),
            });

            if (response.ok) {
                const todoList = await response.json();
                this.showMessage('TODO list created successfully!', 'success');
                this.showPage('dashboard-page');
                this.loadTodoLists();
                // Clear form
                document.getElementById('todo-title').value = '';
                document.getElementById('todo-description').value = '';
            } else {
                const data = await response.json();
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            this.showMessage('Network error', 'error');
        }
    }

    async loadTodoDetail(listId) {
        try {
            const response = await fetch(`/api/todolists/${listId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            if (response.ok) {
                const todoList = await response.json();
                this.currentTodoList = todoList;
                this.renderTodoDetail(todoList);
                this.showPage('todo-detail-page');
            } else {
                this.showMessage('Failed to load todo list', 'error');
            }
        } catch (error) {
            this.showMessage('Network error', 'error');
        }
    }

    renderTodoDetail(todoList) {
        document.getElementById('todo-detail-title').textContent = todoList.title;
        document.getElementById('todo-detail-description').textContent = todoList.description || 'No description';
        
        const tasksContainer = document.getElementById('tasks-container');
        
        if (todoList.tasks.length === 0) {
            tasksContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No tasks yet</h3>
                    <p>Add your first task to get started!</p>
                </div>
            `;
            return;
        }

        tasksContainer.innerHTML = todoList.tasks.map(task => `
            <div class="task-item ${task.completed ? 'completed' : ''}">
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-task-id="${task.id}">
                <div class="task-content">
                    <h4>${task.title}</h4>
                    ${task.description ? `<p>${task.description}</p>` : ''}
                </div>
            </div>
        `).join('');

        // Add click listeners to checkboxes
        document.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const taskId = e.target.dataset.taskId;
                this.toggleTask(taskId);
            });
        });
    }

    async addTask() {
        const title = document.getElementById('task-title').value;
        const description = document.getElementById('task-description').value;

        if (!this.currentTodoList) {
            this.showMessage('No todo list selected', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/todolists/${this.currentTodoList.id}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                body: JSON.stringify({ title, description }),
            });

            if (response.ok) {
                const task = await response.json();
                // Clear form
                document.getElementById('task-title').value = '';
                document.getElementById('task-description').value = '';
                // Reload todo detail to show new task
                this.loadTodoDetail(this.currentTodoList.id);
            } else {
                const data = await response.json();
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            this.showMessage('Network error', 'error');
        }
    }

    async toggleTask(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}/toggle`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            if (response.ok) {
                // Reload todo detail to show updated task status
                this.loadTodoDetail(this.currentTodoList.id);
            } else {
                const data = await response.json();
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            this.showMessage('Network error', 'error');
        }
    }

    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
    }

    showMessage(message, type) {
        const messageDiv = document.getElementById('auth-message');
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new TodoApp();
});
