const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET TIMELINE
router.get('/:patientId', verifyToken, async (req, res) => {
  try {
    const patientId = req.params.patientId;

    // Get admission info
    const [admissions] = await db.query(
      `SELECT * FROM nru_admissions WHERE patient_id = ? ORDER BY admission_date DESC LIMIT 1`,
      [patientId]
    );

    let progressNotes = [];
    let prescriptions = [];

    if (admissions.length > 0) {
      const admissionId = admissions[0].id;

      // Get progress notes
      const [notes] = await db.query(
        `SELECT * FROM progress_notes WHERE admission_id = ? ORDER BY created_at DESC`,
        [admissionId]
      );
      progressNotes = notes;

      // Get prescriptions
      const [presc] = await db.query(
        `SELECT * FROM nru_prescriptions WHERE admission_id = ? ORDER BY created_at DESC`,
        [admissionId]
      );
      prescriptions = presc;
    }

    // Get triage info
    const [triage] = await db.query(
      `SELECT * FROM triage WHERE PatientID = ? ORDER BY created_at DESC LIMIT 1`,
      [patientId]
    );

    res.json({
      admission: admissions[0] || null,
      triage: triage[0] || null,
      progressNotes,
      prescriptions
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;