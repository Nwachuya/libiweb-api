const express = require("express");
const path = require("path");

const router = express.Router();
const viewsDir = path.join(__dirname, "../../config/views");

function sendView(fileName) {
  return (req, res, next) => {
    const filePath = path.join(viewsDir, fileName);
    res.sendFile(filePath, (err) => {
      if (err) next(err);
    });
  };
}

router.get("/docs", sendView("docs.html"));
router.get("/privacy", sendView("privacy.html"));
router.get("/security", sendView("security.html"));
router.get("/terms", sendView("terms.html"));
router.get("/status", sendView("status.html"));

module.exports = router;
