const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Detectar la subruta: /api/auth/register → /register
  const url    = req.url || '';
  const route  = url.includes('/register') ? '/register'
               : url.includes('/login')    ? '/login'
               : url.includes('/me')       ? '/me'
               : '/unknown';

  // ── POST /api/auth/register ────────────────────────────────────────────────
  if (req.method === 'POST' && route === '/register') {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password)
        return res.status(400).json({ error: 'Todos los campos son requeridos.' });
      if (password.length < 6)
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

      const cleanEmail = email.toLowerCase().trim();

      // Verificar si el correo ya existe
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existing)
        return res.status(409).json({ error: 'El correo ya está registrado.' });

      // Encriptar contraseña
      const hashed = await bcrypt.hash(password, 10);

      // Insertar usuario — solo los campos definidos en la tabla
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          name    : name.trim(),
          email   : cleanEmail,
          password: hashed,
          plan    : 'free'
        })
        .select('id, name, email, plan')
        .single();

      if (insertError) {
        console.error('Error al insertar usuario:', insertError);
        return res.status(500).json({ error: 'Error al crear el usuario: ' + insertError.message });
      }

      const token = jwt.sign(
        { id: newUser.id, email: newUser.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({ token, user: newUser });

    } catch (err) {
      console.error('Error en register:', err);
      return res.status(500).json({ error: 'Error interno: ' + err.message });
    }
  }

  // ── POST /api/auth/login ───────────────────────────────────────────────────
  if (req.method === 'POST' && route === '/login') {
    try {
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

      return res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, plan: user.plan }
      });

    } catch (err) {
      console.error('Error en login:', err);
      return res.status(500).json({ error: 'Error interno: ' + err.message });
    }
  }

  // ── GET /api/auth/me ───────────────────────────────────────────────────────
  if (req.method === 'GET' && route === '/me') {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'Token requerido.' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const { data: user } = await supabase
        .from('users')
        .select('id, name, email, plan')
        .eq('id', decoded.id)
        .single();

      if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

      return res.json({ user });

    } catch (err) {
      return res.status(403).json({ error: 'Token inválido.' });
    }
  }

  return res.status(404).json({ error: 'Ruta no encontrada.' });
};