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

  // Ensure phone number starts with 0 for local format (e.g. 099... or 088...)
  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.startsWith('265')) {
    formattedPhone = '0' + formattedPhone.slice(3);
  } else if (formattedPhone.length === 9) {
    formattedPhone = '0' + formattedPhone;
  }

  const tx_ref = `BANA-${patient_id}-${Date.now()}`;

  // Known operator IDs from Paychangu docs
  const operatorIds = {
    'AIRTEL': '20be6c20-adeb-4b5b-a7ba-0769820df4fb', // Airtel Malawi
    'TNM': '27494cb5-ba9e-437f-a114-4e7a7686bcca'    // TNM Mpamba
  };

  const net = network?.toUpperCase() || '';
  let operatorId = operatorIds['AIRTEL'];
  if (net.includes('TNM')) {
    operatorId = operatorIds['TNM'];
  }

  try {
    await db.query(
      `INSERT INTO payments (patient_id, amount, phone, network, tx_ref, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
      [patient_id, amount, phone, network, tx_ref]
    );

    const response = await axios.post(
      'https://api.paychangu.com/mobile-money/payments/initialize',
      {
        mobile_money_operator_ref_id: operatorId,
        mobile: formattedPhone,
        amount: String(amount),
        currency: 'MWK',
        charge_id: tx_ref,
        email: `guardian${patient_id}@banaward.app`,
        first_name: 'Guardian',
        last_name: 'Bana Ward',
        callback_url: 'https://bana-ward-api.onrender.com/api/billing/verify'
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
          'accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Paychangu response:', JSON.stringify(response.data));

    res.json({
      success: true,
      message: 'Payment initiated. Check your phone for a USSD prompt to confirm.',
      tx_ref: tx_ref
    });

  } catch (err) {
    console.error('Payment error:', JSON.stringify(err.response?.data) || err.message);
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

// CHECK PAYMENT STATUS
router.get('/status/:tx_ref', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT status FROM payments WHERE tx_ref = ?`,
      [req.params.tx_ref]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    res.json({ status: rows[0].status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error checking status.' });
  }
});


module.exports = router;