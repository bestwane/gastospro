const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const route = req.url.replace('/api/auth', '');

  // POST /api/auth/register
  if (req.method === 'POST' && route === '/register') {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Todos los campos son requeridos.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

    const { data: existing } = await supabase
      .from('users').select('id').eq('email', email.toLowerCase().trim()).maybeSingle();
    if (existing)
      return res.status(409).json({ error: 'El correo ya está registrado.' });

    const hashed = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase
      .from('users')
      .insert([{ name: name.trim(), email: email.toLowerCase().trim(), password: hashed }])
      .select('id, name, email, plan').single();
    if (error) return res.status(500).json({ error: 'Error al crear el usuario.' });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ token, user });
  }

  // POST /api/auth/login
  if (req.method === 'POST' && route === '/login') {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });

    const { data: user } = await supabase
      .from('users').select('*').eq('email', email.toLowerCase().trim()).maybeSingle();
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas.' });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, plan: user.plan } });
  }

  // GET /api/auth/me
  if (req.method === 'GET' && route === '/me') {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido.' });
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { data: user } = await supabase
        .from('users').select('id, name, email, plan').eq('id', decoded.id).single();
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
      return res.json({ user });
    } catch {
      return res.status(403).json({ error: 'Token inválido.' });
    }
  }

  res.status(404).json({ error: 'Ruta no encontrada.' });
};