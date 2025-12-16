import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("Financial Ledger API running");
});

export default app;
