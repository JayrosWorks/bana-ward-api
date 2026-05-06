const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');

// ===== LOGIN =====
router.post('/login', async (req, res) => {
  const { childName, guardianPhone } = req.body;

  if (!childName || !guardianPhone) {
    return res.status(400).json({ message: 'Please provide child name and guardian phone number.' });
  }

  try {
    const [rows] = await db.query(
      `SELECT * FROM patients WHERE Name = ? AND GuardianPhone = ?`,
      [childName, guardianPhone]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'No record found. Please check the child name and phone number.' });
    }

    const patient = rows[0];

    const token = jwt.sign(
      { id: patient.PatientID, name: patient.Name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      patient: {
        id: patient.PatientID,
        name: patient.Name,
        gender: patient.Gender,
        dob: patient.DOB,
        ward_number: patient.Ward,
        admission_date: patient.admission_date,
        guardian_name: patient.GuardianName,
        guardian_phone: patient.GuardianPhone
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;