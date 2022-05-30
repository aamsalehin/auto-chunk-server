const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ObjectId } = require("mongodb");
const { query } = require("express");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 4000;

//middlewear
app.use(cors());
app.use(express.json());
//jwt
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JSON_SECRET_KEY, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}
//connect mongo
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zobm7.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// get api
app.get("/", (req, res) => {
  res.send("server is running");
});
async function run() {
  try {
    await client.connect();
    const partsCollection = client.db("auto-chunks").collection("parts");
    const orderCollection = client.db("auto-chunks").collection("orders");
    const userCollection = client.db("auto-chunks").collection("users");
    const reviewCollection = client.db("auto-chunks").collection("reviews");
    app.get("/parts", async (req, res) => {
      const query = {};
      const cursor = partsCollection.find(query);
      const parts = await cursor.toArray();
      res.send(parts);
    });
    //post part
    app.post("/parts", async (req, res) => {
      const part = req.body;
      const result = await partsCollection.insertOne(part);
      res.send(result);
    });
    //delete part
    app.delete("/parts/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await partsCollection.deleteOne(query);
      res.send(result);
    });
    //get single parts details and purchase
    app.get("/parts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const product = await partsCollection.findOne(query);
      res.send(product);
    });
    //post order api
    app.post("/order", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      return res.send(result);
    });
    //order quantity substract from stock
    app.put("/order", async (req, res) => {
      const order = req.body;
      const query = { _id: ObjectId(order.productId) };
      const updacteDoc = {
        $set: {
          quantity: order.presentQuantity,
        },
      };
      const result = await partsCollection.updateOne(query, updacteDoc);
      res.send(result);
    });
    //get orders
    app.get("/orders", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;

      if (email === decodedEmail) {
        const query = { email: email };
        const bookings = await orderCollection.find(query).toArray();
        res.send(bookings);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    //api for updating parts
    app.put("/parts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const part = req.body;
      const updateDoc = { $set: part };
      const result = await partsCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    //api for user put in database

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;

      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const updacteDoc = { $set: user };
      const token = jwt.sign({ email: email }, process.env.JSON_SECRET_KEY, {
        expiresIn: "1h",
      });
      const result = await userCollection.updateOne(query, updacteDoc, options);

      res.send({ result, token });
    });
    //user api get
    app.get("/users", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    //get alll orders
    app.get("/orders/admin", verifyJWT, async (req, res) => {
      const orders = await orderCollection.find().toArray();
      res.send(orders);
    });
    //get alll orders

    //get single user
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      res.send(user);
    });
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });
    //put make admin

    app.put("/user/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;

      const requesterAcc = await userCollection.findOne({ email: requester });
      if (requesterAcc.role === "admin") {
        const query = { email: email };
        const updacteDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(query, updacteDoc);
        res.send(result);
      } else {
        return res.status(403).send({ message: "forbidden" });
      }
    });
    //put user info
    app.put("/user/info/:email", async (req, res) => {
      const email = req.params.email;
      const info = req.body;
      const query = { email: email };
      const updacteDoc = {
        $set: {
          location: info.location,
          education: info.education,
          phone: info.phone,
          linkedin: info.linkedin,
        },
      };
      const result = await userCollection.updateOne(query, updacteDoc);
      res.send(result);
    });
    //put make admin

    app.put("/user/user/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAcc = await userCollection.findOne({ email: requester });
      if (requesterAcc.role === "admin") {
        const query = { email: email };
        const updacteDoc = {
          $set: {
            role: "user",
          },
        };
        const result = await userCollection.updateOne(query, updacteDoc);
        res.send(result);
      } else {
        return res.status(403).send({ message: "forbidden" });
      }
    });
    //get reviews api
    app.get("/reviews", async (req, res) => {
      const query = {};
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });
    //post review
    app.post("/review", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

//listning to port
app.listen(port, () => {
  console.log(`app is listening to port ${port}`);
});
