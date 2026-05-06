const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET VITALS via admission_id
router.get('/:patientId', verifyToken, async (req, res) => {
  try {
    // First get the admission record for this patient
    const [admissions] = await db.query(
      `SELECT id FROM nru_admissions WHERE patient_id = ? ORDER BY admission_date DESC LIMIT 1`,
      [req.params.patientId]
    );

    if (admissions.length === 0) {
      return res.json([]);
    }

    const admissionId = admissions[0].id;

    const [rows] = await db.query(
      `SELECT * FROM nru_vitals WHERE admission_id = ? ORDER BY recorded_at DESC`,
      [admissionId]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;