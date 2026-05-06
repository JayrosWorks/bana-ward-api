const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET NUTRITION
router.get('/:patientId', verifyToken, async (req, res) => {
  try {
    // Get admission for feed logs
    const [admissions] = await db.query(
      `SELECT id FROM nru_admissions WHERE patient_id = ? ORDER BY admission_date DESC LIMIT 1`,
      [req.params.patientId]
    );

    let feedLogs = [];
    if (admissions.length > 0) {
      const [logs] = await db.query(
        `SELECT * FROM nru_feed_logs WHERE admission_id = ? ORDER BY given_at DESC`,
        [admissions[0].id]
      );
      feedLogs = logs;
    }

    // Get nutrition assessment
    const [assessment] = await db.query(
      `SELECT * FROM nutrition_assessment WHERE PatientID = ? ORDER BY created_at DESC LIMIT 1`,
      [req.params.patientId]
    );

    // Get feeding plan
    const [feedingPlan] = await db.query(
      `SELECT * FROM nutrition_feeding WHERE PatientID = ? ORDER BY created_at DESC LIMIT 1`,
      [req.params.patientId]
    );

    res.json({
      feedLogs,
      assessment: assessment[0] || null,
      feedingPlan: feedingPlan[0] || null
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;