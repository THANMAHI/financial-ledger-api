import express from "express";
import pool from "./config/db.js";
import accountsRouter from "./routes/accounts.js";
import depositsRouter from "./routes/deposits.js";
import withdrawalsRouter from "./routes/withdrawals.js";
import transfersRouter from "./routes/transfers.js";

const app = express();

app.use(express.json());   
app.use("/accounts", accountsRouter); 
app.use("/deposits", depositsRouter);
app.use("/withdrawals", withdrawalsRouter);
app.use("/transfers", transfersRouter);

app.get("/", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.send("API running. DB time: " + result.rows[0].now);
});

export default app;
