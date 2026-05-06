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
  const { patient_id, amount, phone } = req.body;

  try {
    const response = await axios.post(
      'https://api.paychangu.com/payment',
      {
        amount: amount,
        currency: 'MWK',
        email: `${phone}@banaward.app`,
        first_name: 'Guardian',
        last_name: '',
        callback_url: 'http://localhost:3000/api/billing/verify',
        return_url: 'http://localhost:3000/api/billing/success',
        tx_ref: `BANA-${patient_id}-${Date.now()}`,
        customization: {
          title: 'Bana Ward Payment',
          description: `Hospital bill payment for patient ID ${patient_id}`
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ payment_url: response.data.data.checkout_url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Payment initiation failed.' });
  }
});

module.exports = router;