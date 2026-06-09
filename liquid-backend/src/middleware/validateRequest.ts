import express = require("express");

function validateRequest(requiredFields: string[]): express.RequestHandler {
  return (req, res, next): void => {
    for (const field of requiredFields) {
      if (req.body?.[field] === undefined || req.body[field] === null || req.body[field] === "") {
        res.status(400).json({ success: false, message: `${field} is required` });
        return;
      }
    }

    next();
  };
}

export = validateRequest;
