const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');
const db = require('../db');

// GET BILLING
router.get('/:patientId', verifyToken, async (req, res) => {
  try {
    const response = await axios.get(
      `${process.env.LOCAL_API_URL}?action=billing&patient_id=${req.params.patientId}`,
      { headers: { 'ngrok-skip-browser-warning': 'true' } }
    );
    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// INITIATE PAYMENT
router.post('/pay', verifyToken, async (req, res) => {
  const { patient_id, amount, phone, network } = req.body;

  let formattedPhone = phone.replace(/^0/, '265');
  const tx_ref = `BANA-${patient_id}-${Date.now()}`;

  try {
    // Save payment record as pending
    await db.query(
      `INSERT INTO payments (patient_id, amount, phone, network, tx_ref, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
      [patient_id, amount, phone, network, tx_ref]
    );

    const response = await axios.post(
      'https://api.paychangu.com/payment',
      {
  amount: amount,
  currency: 'MWK',
  email: `guardian${patient_id}@banaward.app`,
  first_name: 'Guardian',
  last_name: 'Bana Ward',
  callback_url: 'https://bana-ward-api.onrender.com/api/billing/verify',
  return_url: 'https://bana-ward-api.onrender.com/api/billing/success',
  tx_ref: tx_ref,
  customization: {
    title: 'Bana Ward Payment',
    description: `Hospital bill payment`
  }
},
      {
        headers: {
  Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
  'public-key': process.env.PAYCHANGU_PUBLIC_KEY,
  'Content-Type': 'application/json'
}
      }
    );

    res.json({
      success: true,
      message: response.data.message || 'Payment initiated. Check your phone for USSD prompt.',
      tx_ref: tx_ref
    });

  } catch (err) {
    console.error('Payment error:', err.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: err.response?.data?.message || 'Payment initiation failed.'
    });
  }
});

// PAYMENT CALLBACK
router.get('/verify', async (req, res) => {
  const { tx_ref, status } = req.query;

  try {
    if (status === 'successful') {
      await db.query(
        `UPDATE payments SET status = 'successful' WHERE tx_ref = ?`,
        [tx_ref]
      );
    } else {
      await db.query(
        `UPDATE payments SET status = 'failed' WHERE tx_ref = ?`,
        [tx_ref]
      );
    }
    res.json({ message: 'Payment status updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Verification failed.' });
  }
});

module.exports = router;