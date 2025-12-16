import express from "express";
import pool from "../config/db.js";

const router = express.Router();

/**
 * POST /withdrawals
 * Withdraw money from an account
 */
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const { account_id, amount, currency } = req.body;

    if (!account_id || !amount || !currency) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await client.query("BEGIN");

    // 1. Calculate current balance
    const balanceResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS balance
       FROM ledger_entries
       WHERE account_id = $1`,
      [account_id]
    );

    const currentBalance = parseFloat(balanceResult.rows[0].balance);

    // 2. Check sufficient balance
    if (currentBalance < amount) {
      await client.query("ROLLBACK");
      return res.status(422).json({ error: "Insufficient funds" });
    }

    // 3. Create transaction
    const txResult = await client.query(
      `INSERT INTO transactions (type, source_account_id, amount, currency, status)
       VALUES ('withdrawal', $1, $2, $3, 'completed')
       RETURNING id`,
      [account_id, amount, currency]
    );

    const transactionId = txResult.rows[0].id;

    // 4. Create ledger entry (debit as negative amount)
    await client.query(
      `INSERT INTO ledger_entries (account_id, transaction_id, entry_type, amount)
       VALUES ($1, $2, 'debit', $3)`,
      [account_id, transactionId, -amount]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Withdrawal successful",
      transaction_id: transactionId
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Withdrawal failed" });
  } finally {
    client.release();
  }
});

export default router;
