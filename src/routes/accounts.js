import express from "express";
import pool from "../config/db.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { user_id, account_type, currency } = req.body;

    if (!user_id || !account_type || !currency) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      `INSERT INTO accounts (user_id, account_type, currency, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING *`,
      [user_id, account_type, currency]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

/**
 * GET /accounts/:id
 * Get account details with calculated balance
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get account details
    const accountResult = await pool.query(
      "SELECT * FROM accounts WHERE id = $1",
      [id]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    // 2. Calculate balance from ledger
    const balanceResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS balance
       FROM ledger_entries
       WHERE account_id = $1`,
      [id]
    );

    const account = accountResult.rows[0];
    account.balance = balanceResult.rows[0].balance;

    res.json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch account" });
  }
});

/**
 * GET /accounts/:id/ledger
 * Get ledger entries for an account
 */
router.get("/:id/ledger", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
         id,
         transaction_id,
         entry_type,
         amount,
         created_at
       FROM ledger_entries
       WHERE account_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch ledger entries" });
  }
});


export default router;
