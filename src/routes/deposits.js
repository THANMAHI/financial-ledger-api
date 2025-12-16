import express from "express";
import pool from "../config/db.js";

const router = express.Router();

/**
 * POST /deposits
 * Deposit money into an account
 */
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const { account_id, amount, currency } = req.body;

    if (!account_id || !amount || !currency) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await client.query("BEGIN");

    // 1. Create transaction
    const txResult = await client.query(
      `INSERT INTO transactions (type, destination_account_id, amount, currency, status)
       VALUES ('deposit', $1, $2, $3, 'completed')
       RETURNING id`,
      [account_id, amount, currency]
    );

    const transactionId = txResult.rows[0].id;

    // 2. Create ledger entry (credit)
    await client.query(
      `INSERT INTO ledger_entries (account_id, transaction_id, entry_type, amount)
       VALUES ($1, $2, 'credit', $3)`,
      [account_id, transactionId, amount]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Deposit successful",
      transaction_id: transactionId
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Deposit failed" });
  } finally {
    client.release();
  }
});

export default router;
