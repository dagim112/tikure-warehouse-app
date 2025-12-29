// master-control-server.js
// Run: node master-control-server.js
// Requires: npm install express sqlite3 body-parser cors

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'master_control.db');
const MASTER_TOKEN = process.env.MASTER_TOKEN || 'change-me-master-token';

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Simple auth middleware
function requireMasterToken(req, res, next) {
  const token = req.headers['x-master-token'];
  if (!token || token !== MASTER_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  req.master = { id: 'master-admin', name: 'PlatformOwner' };
  next();
}

// Initialize DB
const dbExists = fs.existsSync(DB_FILE);
const db = new sqlite3.Database(DB_FILE);

db.serialize(() => {
  if (!dbExists) {
    db.run(`CREATE TABLE tenants (
      id TEXT PRIMARY KEY,
      name TEXT,
      status TEXT,
      created_at INTEGER,
      last_active INTEGER,
      meta TEXT
    )`);
    db.run(`CREATE TABLE users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      name TEXT,
      role TEXT,
      email TEXT,
      created_at INTEGER
    )`);
    db.run(`CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT,
      actor TEXT,
      action TEXT,
      details TEXT,
      created_at INTEGER
    )`);
    console.log('Database initialized.');
  }
});

// Helper: audit log
function audit(tenantId, actor, action, details) {
  const stmt = db.prepare(`INSERT INTO audit_logs (tenant_id, actor, action, details, created_at) VALUES (?, ?, ?, ?, ?)`);
  stmt.run(tenantId || null, actor || 'system', action, JSON.stringify(details || {}), Date.now());
  stmt.finalize();
}

// Utilities
const { v4: uuidv4 } = require('uuid');

// Routes
app.use(requireMasterToken);

// List tenants
app.get('/api/tenants', (req, res) => {
  const q = req.query.q || '';
  const status = req.query.status;
  let sql = 'SELECT id, name, status, created_at, last_active, meta FROM tenants';
  const params = [];
  if (q || status) {
    sql += ' WHERE ';
    const clauses = [];
    if (q) { clauses.push('(name LIKE ? OR id LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    if (status) { clauses.push('status = ?'); params.push(status); }
    sql += clauses.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC LIMIT 500';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    rows.forEach(r => { try { r.meta = JSON.parse(r.meta || '{}'); } catch(e){ r.meta = {}; } });
    res.json(rows);
  });
});

// Create tenant
app.post('/api/tenants', (req, res) => {
  const { name, meta } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = uuidv4();
  const now = Date.now();
  const stmt = db.prepare('INSERT INTO tenants (id,name,status,created_at,last_active,meta) VALUES (?,?,?,?,?,?)');
  stmt.run(id, name, 'active', now, now, JSON.stringify(meta || {}), function(err) {
    if (err) return res.status(500).json({ error: err.message });
    audit(id, req.master.id, 'create_tenant', { name, id });
    res.json({ id, name, status: 'active', created_at: now });
  });
});

// Get tenant details
app.get('/api/tenants/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT id,name,status,created_at,last_active,meta FROM tenants WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    try { row.meta = JSON.parse(row.meta || '{}'); } catch(e){ row.meta = {}; }
    db.all('SELECT id,name,role,email,created_at FROM users WHERE tenant_id = ?', [id], (err2, users) => {
      if (err2) return res.status(500).json({ error: err2.message });
      row.users = users;
      // counts
      db.get('SELECT COUNT(*) as storeCount FROM users WHERE tenant_id = ?', [id], (err3, c) => {
        row.userCount = c ? c.storeCount : 0;
        res.json(row);
      });
    });
  });
});

// Update tenant
app.put('/api/tenants/:id', (req, res) => {
  const id = req.params.id;
  const { name, meta } = req.body;
  db.get('SELECT * FROM tenants WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    const newName = name || row.name;
    const newMeta = meta ? JSON.stringify(meta) : row.meta;
    db.run('UPDATE tenants SET name = ?, meta = ? WHERE id = ?', [newName, newMeta, id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      audit(id, req.master.id, 'update_tenant', { id, name: newName });
      res.json({ id, name: newName });
    });
  });
});

// Suspend tenant
app.post('/api/tenants/:id/suspend', (req, res) => {
  const id = req.params.id;
  const reason = req.body.reason || '';
  db.run('UPDATE tenants SET status = ? WHERE id = ?', ['suspended', id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    audit(id, req.master.id, 'suspend_tenant', { reason });
    res.json({ id, status: 'suspended' });
  });
});

// Restore tenant
app.post('/api/tenants/:id/restore', (req, res) => {
  const id = req.params.id;
  const reason = req.body.reason || '';
  db.run('UPDATE tenants SET status = ? WHERE id = ?', ['active', id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    audit(id, req.master.id, 'restore_tenant', { reason });
    res.json({ id, status: 'active' });
  });
});

// Delete tenant
app.delete('/api/tenants/:id', (req, res) => {
  const id = req.params.id;
  const force = req.query.force === '1' || req.body.force === true;
  // For safety, we soft-delete by default (status=deleted). If force=true, remove rows.
  if (!force) {
    db.run('UPDATE tenants SET status = ? WHERE id = ?', ['deleted', id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      audit(id, req.master.id, 'soft_delete_tenant', { });
      res.json({ id, status: 'deleted' });
    });
  } else {
    db.serialize(() => {
      db.run('DELETE FROM users WHERE tenant_id = ?', [id]);
      db.run('DELETE FROM tenants WHERE id = ?', [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        audit(id, req.master.id, 'hard_delete_tenant', { });
        res.json({ id, deleted: true });
      });
    });
  }
});

// Create user
app.post('/api/users', (req, res) => {
  const { tenant_id, name, role, email } = req.body;
  if (!tenant_id || !name || !role) return res.status(400).json({ error: 'tenant_id, name, role required' });
  const id = uuidv4();
  const now = Date.now();
  db.run('INSERT INTO users (id, tenant_id, name, role, email, created_at) VALUES (?,?,?,?,?,?)', [id, tenant_id, name, role, email || '', now], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    audit(tenant_id, req.master.id, 'create_user', { id, name, role, email });
    res.json({ id, tenant_id, name, role, email });
  });
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT tenant_id, name FROM users WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    db.run('DELETE FROM users WHERE id = ?', [id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      audit(row.tenant_id, req.master.id, 'delete_user', { id, name: row.name });
      res.json({ id, deleted: true });
    });
  });
});

// Tenant audit logs
app.get('/api/tenants/:id/audit', (req, res) => {
  const id = req.params.id;
  const limit = parseInt(req.query.limit || '200', 10);
  db.all('SELECT id, actor, action, details, created_at FROM audit_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?', [id, limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    rows.forEach(r => { try { r.details = JSON.parse(r.details || '{}'); } catch(e){ r.details = {}; } });
    res.json(rows);
  });
});

// Global audit feed
app.get('/api/audit', (req, res) => {
  const limit = parseInt(req.query.limit || '200', 10);
  db.all('SELECT id, tenant_id, actor, action, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT ?', [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    rows.forEach(r => { try { r.details = JSON.parse(r.details || '{}'); } catch(e){ r.details = {}; } });
    res.json(rows);
  });
});

// Impersonate (support) - returns a short-lived token (demo only)
app.post('/api/impersonate', (req, res) => {
  const { tenant_id, user_id } = req.body;
  if (!tenant_id || !user_id) return res.status(400).json({ error: 'tenant_id and user_id required' });
  // In production, generate a signed JWT with short expiry and store mapping.
  const token = 'impersonation-' + uuidv4();
  audit(tenant_id, req.master.id, 'impersonate', { user_id, token });
  res.json({ token, expires_in_seconds: 300 });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Master Control Console API running on http://localhost:${PORT}`);
  console.log(`Use header x-master-token: ${MASTER_TOKEN}`);
});
