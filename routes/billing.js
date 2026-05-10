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

  // Format phone — remove leading 0 and add 265
  let formattedPhone = phone.replace(/^0/, '265');
  const tx_ref = `BANA-${patient_id}-${Date.now()}`;

  // Operator ref IDs from Paychangu
  // Airtel Malawi and TNM Malawi operator IDs
  const operatorIds = {
    'AIRTEL': 'tnm-malawi',   // replace with correct ID from Paychangu dashboard
    'TNM': 'airtel-malawi'    // replace with correct ID from Paychangu dashboard
  };

  try {
    // Save payment record as pending
    await db.query(
      `INSERT INTO payments (patient_id, amount, phone, network, tx_ref, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
      [patient_id, amount, phone, network, tx_ref]
    );

    const response = await axios.post(
      'https://api.paychangu.com/mobile-money/payments/initialize',
      {
        mobile: formattedPhone,
        mobile_money_operator_ref_id: operatorIds[network],
        amount: String(amount),
        charge_id: tx_ref,
        email: `guardian${patient_id}@banaward.app`,
        first_name: 'Guardian',
        last_name: 'Bana Ward'
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Paychangu response:', response.data);

    res.json({
      success: true,
      message: 'Payment initiated. Check your phone for a USSD prompt to confirm.',
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

// GET OPERATORS
router.get('/operators', async (req, res) => {
  try {
    const response = await axios.get(
      'https://api.paychangu.com/mobile-money/operators',
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ message: 'Failed to get operators.' });
  }
});

module.exports = router;