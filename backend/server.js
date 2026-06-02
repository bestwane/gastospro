require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

// ── Validar variables de entorno al arrancar ─────────────────────────────────
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_KEY', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);

// En ambientes serverless no conviene hard-crashear el proceso.
// Mostramos un error claro y evitamos que Vercel registre “crash”.
const envValid = missing.length === 0;
if (!envValid) {
  console.error('❌ Variables de entorno faltantes:', missing.join(', '));
}

const authRoutes        = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');

const app  = express();

// Si faltan variables de entorno requeridas, evitamos errores internos
// en rutas /api. Devolvemos un 500 claro en vez de “crash”.
app.use('/api', (req, res, next) => {
  if (envValid) return next();
  return res.status(500).json({
    error: 'Configuración incompleta en el backend.',
    missing
  });
});
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
    status: envValid ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    env: {
      supabaseUrl: !!process.env.SUPABASE_URL,
      supabaseKey: !!process.env.SUPABASE_KEY,
      jwt: !!process.env.JWT_SECRET
    },
    missing: missing
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