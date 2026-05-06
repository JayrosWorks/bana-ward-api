const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');

router.get('/:patientId', verifyToken, async (req, res) => {
  try {
    const response = await axios.get(
      `${process.env.LOCAL_API_URL}?action=vitals&patient_id=${req.params.patientId}`,
      { headers: { 'ngrok-skip-browser-warning': 'true' } }
    );
    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;