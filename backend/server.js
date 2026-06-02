require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

// ── Validar variables de entorno al arrancar ─────────────────────────────────
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_KEY', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error('❌ Variables de entorno faltantes:', missing.join(', '));
  process.exit(1);
}

const authRoutes        = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares globales ─────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Archivos estáticos ───────────────────────────────────────────────────────
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// ── Rutas de la API ──────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/transactions', transactionRoutes);

// ── Ruta de salud ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      supabase: !!process.env.SUPABASE_URL,
      jwt: !!process.env.JWT_SECRET
    }
  });
});

// ── Manejo de errores global ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error del servidor:', err.message);
  res.status(500).json({ error: 'Error interno del servidor.', detail: err.message });
});

// ── Cualquier otra ruta devuelve el frontend ─────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Iniciar servidor (solo en local, Vercel lo maneja automáticamente) ────────
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`✅ GastosPro backend corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;