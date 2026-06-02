const jwt    = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function verifyToken(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) throw new Error('Token requerido.');
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let user;
  try { user = verifyToken(req); }
  catch (e) { return res.status(401).json({ error: e.message }); }

  // GET /api/transactions
  if (req.method === 'GET') {
    const { year, month } = req.query;
    let query = supabase.from('transactions').select('*')
      .eq('user_id', user.id).order('date', { ascending: false });

    if (year && month !== undefined) {
      const m = Number(month) + 1;
      const start = `${year}-${String(m).padStart(2,'0')}-01`;
      const lastDay = new Date(Number(year), m, 0).getDate();
      const end = `${year}-${String(m).padStart(2,'0')}-${lastDay}`;
      query = query.gte('date', start).lte('date', end);
    } else if (year) {
      query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Error al obtener transacciones.' });
    return res.json(data);
  }

  // POST /api/transactions
  if (req.method === 'POST') {
    const { type, cat, amount, date, desc, ccname, currency } = req.body;
    if (!type || !cat || !amount || !date)
      return res.status(400).json({ error: 'Faltan campos requeridos.' });

    const { data, error } = await supabase.from('transactions')
      .insert([{
        user_id : user.id, type, cat,
        amount  : parseFloat(Number(amount).toFixed(2)),
        date, desc: desc?.trim() || '',
        ccname  : type === 'card' ? (ccname?.trim() || 'Sin nombre') : '',
        currency: currency || 'USD'
      }]).select().single();

    if (error) return res.status(500).json({ error: 'Error al guardar la transacción.' });
    return res.status(201).json(data);
  }

  // DELETE /api/transactions?id=xxx
  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'ID requerido.' });

    const { error } = await supabase.from('transactions')
      .delete().eq('id', id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: 'Error al eliminar.' });
    return res.json({ success: true });
  }

  res.status(404).json({ error: 'Ruta no encontrada.' });
};