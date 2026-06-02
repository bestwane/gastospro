const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  realtime: {
    transport: WebSocket,
  },
});

// Todas las rutas de este archivo requieren autenticación
router.use(authMiddleware);

// ── GET /api/transactions ────────────────────────────────────────────────────
// Parámetros opcionales: ?year=2025&month=5 (mes en base 0)
router.get('/', async (req, res) => {
  const { year, month } = req.query;

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', req.user.id)
    .order('date', { ascending: false });

  // Filtrar por mes y año si se proporcionan
  if (year !== undefined && month !== undefined) {
    const m = Number(month) + 1; // Convertir de base 0 a base 1
    const start = `${year}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(Number(year), m, 0).getDate();
    const end = `${year}-${String(m).padStart(2, '0')}-${lastDay}`;
    query = query.gte('date', start).lte('date', end);
  }

  // Filtrar por año completo
  if (year !== undefined && month === undefined) {
    const start = `${year}-01-01`;
    const end   = `${year}-12-31`;
    query = query.gte('date', start).lte('date', end);
  }

  const { data, error } = await query;

  if (error)
    return res.status(500).json({ error: 'Error al obtener las transacciones.' });

  res.json(data);
});

// ── POST /api/transactions ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { type, cat, amount, date, desc, ccname, currency } = req.body;

  if (!type || !cat || !amount || !date)
    return res.status(400).json({ error: 'Los campos tipo, categoría, monto y fecha son requeridos.' });

  if (!['income', 'expense', 'card'].includes(type))
    return res.status(400).json({ error: 'Tipo de movimiento inválido.' });

  if (isNaN(amount) || Number(amount) <= 0)
    return res.status(400).json({ error: 'El monto debe ser un número positivo.' });

  const { data, error } = await supabase
    .from('transactions')
    .insert([{
      user_id  : req.user.id,
      type,
      cat,
      amount   : parseFloat(Number(amount).toFixed(2)),
      date,
      desc     : desc?.trim() || '',
      ccname   : type === 'card' ? (ccname?.trim() || 'Sin nombre') : '',
      currency : currency || 'USD'
    }])
    .select()
    .single();

  if (error)
    return res.status(500).json({ error: 'Error al guardar la transacción.' });

  res.status(201).json(data);
});

// ── DELETE /api/transactions/:id ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  // La condición user_id garantiza que un usuario no pueda eliminar datos de otro
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error)
    return res.status(500).json({ error: 'Error al eliminar la transacción.' });

  res.json({ success: true, message: 'Transacción eliminada correctamente.' });
});

// ── GET /api/transactions/summary ────────────────────────────────────────────
// Devuelve totales agrupados por mes para el resumen anual
router.get('/summary/:year', async (req, res) => {
  const { year } = req.params;

  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount, date')
    .eq('user_id', req.user.id)
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`);

  if (error)
    return res.status(500).json({ error: 'Error al obtener el resumen anual.' });

  // Agrupar por mes
  const summary = Array.from({ length: 12 }, (_, i) => ({
    month: i,
    income : 0,
    expense: 0,
    card   : 0
  }));

  data.forEach(tx => {
    const m = new Date(tx.date).getMonth();
    if (tx.type === 'income')   summary[m].income  += Number(tx.amount);
    if (tx.type === 'expense')  summary[m].expense += Number(tx.amount);
    if (tx.type === 'card')     summary[m].card    += Number(tx.amount);
  });

  res.json(summary);
});

module.exports = router;