import express from "express";
import pool from "../config/db.js";

const router = express.Router();

/**
 * POST /transfers
 * Transfer money between two accounts (double-entry)
 */
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const { source_account_id, destination_account_id, amount, currency } = req.body;

    if (!source_account_id || !destination_account_id || !amount || !currency) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (source_account_id === destination_account_id) {
      return res.status(400).json({ error: "Source and destination cannot be same" });
    }

    await client.query("BEGIN");

    // 1. Calculate source balance
    const balanceResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS balance
       FROM ledger_entries
       WHERE account_id = $1`,
      [source_account_id]
    );

    const sourceBalance = parseFloat(balanceResult.rows[0].balance);

    if (sourceBalance < amount) {
      await client.query("ROLLBACK");
      return res.status(422).json({ error: "Insufficient funds" });
    }

    // 2. Create transaction record
    const txResult = await client.query(
      `INSERT INTO transactions
       (type, source_account_id, destination_account_id, amount, currency, status)
       VALUES ('transfer', $1, $2, $3, $4, 'completed')
       RETURNING id`,
      [source_account_id, destination_account_id, amount, currency]
    );

    const transactionId = txResult.rows[0].id;

    // 3. Debit source account
    await client.query(
      `INSERT INTO ledger_entries
       (account_id, transaction_id, entry_type, amount)
       VALUES ($1, $2, 'debit', $3)`,
      [source_account_id, transactionId, -amount]
    );

    // 4. Credit destination account
    await client.query(
      `INSERT INTO ledger_entries
       (account_id, transaction_id, entry_type, amount)
       VALUES ($1, $2, 'credit', $3)`,
      [destination_account_id, transactionId, amount]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Transfer successful",
      transaction_id: transactionId
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Transfer failed" });
  } finally {
    client.release();
  }
});

export default router;
