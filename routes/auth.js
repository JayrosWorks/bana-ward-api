const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');

router.post('/login', async (req, res) => {
  const { childName, guardianPhone } = req.body;

  if (!childName || !guardianPhone) {
    return res.status(400).json({ message: 'Please provide child name and guardian phone number.' });
  }

  try {
    const response = await axios.post(
      `${process.env.LOCAL_API_URL}?action=login`,
      { childName, guardianPhone },
      { headers: { 'ngrok-skip-browser-warning': 'true' } }
    );

    const data = response.data;

    if (!data.success) {
      return res.status(401).json({ message: data.message || 'No record found.' });
    }

    const patient = data.patient;

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
        ward_number: patient.ward_number,
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