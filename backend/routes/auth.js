const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  realtime: {
    transport: WebSocket,
  },
});

// ── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: 'Todos los campos son requeridos.' });

  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

  // Verificar si el correo ya existe
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (existing)
    return res.status(409).json({ error: 'El correo ya está registrado.' });

  // Encriptar contraseña y crear usuario
  const hashedPassword = await bcrypt.hash(password, 10);

  const { data: newUser, error } = await supabase
    .from('users')
    .insert([{ name: name.trim(), email: email.toLowerCase().trim(), password: hashedPassword }])
    .select('id, name, email, plan, created_at')
    .single();

  if (error)
    return res.status(500).json({ error: 'Error al crear el usuario. Intenta nuevamente.' });

  const token = jwt.sign(
    { id: newUser.id, email: newUser.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({ token, user: newUser });
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (!user)
    return res.status(401).json({ error: 'Credenciales incorrectas.' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid)
    return res.status(401).json({ error: 'Credenciales incorrectas.' });

  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, plan: user.plan }
  });
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
// Permite al frontend verificar si un token guardado sigue siendo válido
const authMiddleware = require('../middleware/authMiddleware');

router.get('/me', authMiddleware, async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email, plan, created_at')
    .eq('id', req.user.id)
    .single();

  if (!user)
    return res.status(404).json({ error: 'Usuario no encontrado.' });

  res.json({ user });
});

module.exports = router;