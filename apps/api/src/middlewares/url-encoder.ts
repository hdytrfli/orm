import express from 'express';

export const urlEncoder = express.urlencoded({
  extended: false,
  limit: '1mb',
});
