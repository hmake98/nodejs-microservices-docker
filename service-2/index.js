const express = require("express");
const app = express();
require("dotenv").config({ path: ".env" });
const ampq = require("amqplib");
const csv = require("csvtojson");
let channel, connection;

const knex = require("knex")({
  client: "pg",
  connection: process.env.PG_CONNECTION_STRING,
  searchPath: ["knex", "public"],
});
connect();

async function connect() {
  try {
    const amqpServer = `amqp://guest:guest@${process.env.RABBIT_HOST}:${process.env.RABBIT_PORT}`;
    connection = await ampq.connect(amqpServer);
    channel = await connection.createChannel();
    await channel.assertQueue("upload-queue");
    // consume one message at a time
    channel.prefetch(1); 
    channel.consume("upload-queue", (data) => {
      const content = Buffer.from(data.content).toString("utf-8");
      csv({
        noheader: false,
        output: "json",
      })
        .fromString(content)
        .then(async (csvRow) => {
          knex.schema
            .createTableIfNotExists("employees", (table) => {
              table.increments();
              table.string("employee_name");
              table.string("phone_number");
              table.string("email");
              table.string("company");
            })
            .then(async () => {
              await knex("employees").insert(csvRow);
              // acknowledge the data has recieved
              channel.ack(data);
            });
        })
        .catch((err) => {
          console.log(err);
        });
    });
  } catch (err) {
    console.log(err);
  }
}

const port = process.env.SERVICE_2_PORT;

app.listen(port, () => {
  console.log(`Consumer Service listening on port: ${port}`);
});
