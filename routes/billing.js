const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const axios = require('axios');

// GET BILLING SUMMARY
router.get('/:patientId', verifyToken, async (req, res) => {
  try {
    const patientId = req.params.patientId;

    // Get latest admission
    const [admissions] = await db.query(
      `SELECT * FROM nru_admissions WHERE patient_id = ? ORDER BY admission_date DESC LIMIT 1`,
      [patientId]
    );

    if (admissions.length === 0) {
      return res.json([]);
    }

    const admission = admissions[0];

    // Build billing summary from available data
    const billingItems = [];

    // Admission fee
    billingItems.push({
      item: 'Admission Fee',
      amount: 5000,
      paid: false
    });

    // Count prescriptions
    const [prescriptions] = await db.query(
      `SELECT COUNT(*) as count FROM nru_prescriptions WHERE admission_id = ?`,
      [admission.id]
    );
    if (prescriptions[0].count > 0) {
      billingItems.push({
        item: `Medications (${prescriptions[0].count} prescriptions)`,
        amount: prescriptions[0].count * 2000,
        paid: false
      });
    }

    // Count feed logs
    const [feedLogs] = await db.query(
      `SELECT COUNT(*) as count FROM nru_feed_logs WHERE admission_id = ?`,
      [admission.id]
    );
    if (feedLogs[0].count > 0) {
      billingItems.push({
        item: `Feeding Sessions (${feedLogs[0].count} sessions)`,
        amount: feedLogs[0].count * 500,
        paid: false
      });
    }

    // Count vitals
    const [vitals] = await db.query(
      `SELECT COUNT(*) as count FROM nru_vitals WHERE admission_id = ?`,
      [admission.id]
    );
    if (vitals[0].count > 0) {
      billingItems.push({
        item: `Vitals Monitoring (${vitals[0].count} sessions)`,
        amount: vitals[0].count * 300,
        paid: false
      });
    }

    res.json(billingItems);

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
      'https://api.paychangu.com/mobile-money',
      {
        amount: amount,
        currency: 'MWK',
        mobile: formattedPhone,
        network: network,
        tx_ref: tx_ref,
        callback_url: 'https://bana-ward-api.onrender.com/api/billing/verify',
        customization: {
          title: 'Bana Ward Payment',
          description: `Hospital bill payment`
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
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