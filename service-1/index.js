require("dotenv").config({ path: ".env" });
const express = require("express");
const app = express();
app.use(express.json());
const ampq = require("amqplib");
const multer = require("multer");
const fs = require("fs");
const { join } = require("path");
var channel, connection;
connect();

async function connect() {
  try {
    const amqpServer = `amqp://guest:guest@${process.env.RABBIT_HOST}:${process.env.RABBIT_PORT}`;
    connection = await ampq.connect(amqpServer);
    channel = await connection.createChannel();
    await channel.assertQueue("upload-queue");
  } catch (err) {
    console.log(err);
  }
}

app.post(
  "/csv-upload",
  multer({ dest: "uploads/" }).single("file"),
  async (req, res) => {
    try {
      const path = join(__dirname, req.file.path);
      const string = fs.readFileSync(path, "utf-8");
      await channel.sendToQueue("upload-queue", Buffer.from(string));
      return res.status(200).json({
        status: true,
        message: 'File upload done.'
      });
    } catch (err) {
      return res.status(500).json({
        status: false,
        error: 'INTERNAL_SERVER_ERROR'
      })
    }
  }
);

const port = process.env.SERVICE_1_PORT;

app.listen(port, () => {
  console.log(`Producer Service listening on port: ${port}`);
});
