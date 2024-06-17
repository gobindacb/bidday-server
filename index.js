const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000
const jwt = require("jsonwebtoken");
const app = express()

// middleware
const corsOptions = {
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://bid-day-11684.web.app'
    ],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions));
app.use(express.json());


function createToken(user) {
    const token = jwt.sign(
      {
        email: user.email
      },
      "secret",
      { expiresIn: "7d" }
    );
    return token;
  }

  function verifyToken(req, res, next) {
    // Check if the Authorization header is present
    if (!req.headers.authorization) {
      return res.status(401).send("Authorization header missing");
    }
  
    // Split the Authorization header to extract the token
    const authHeaderParts = req.headers.authorization.split(" ");
    if (authHeaderParts.length !== 2 || authHeaderParts[0] !== 'Bearer') {
      return res.status(401).send("Invalid Authorization header format");
    }
  
    const token = authHeaderParts[1];
  
    // Verify the token
    try {
      const verify = jwt.verify(token, "secret");
  
      if (!verify || !verify.email) {
        return res.status(401).send("You are not authorized");
      }
  
      // Attach the user email to the request object
      req.user = verify.email;
      next();
    } catch (error) {
      return res.status(401).send("Invalid token");
    }
  }

//   function verifyToken(req, res, next) {
//     const token = req.headers.authorization.split(" ")[1];
//     const verify = jwt.verify(token, "secret");
//     if (!verify?.email) {
//       return res.send("You are not authorized");
//     }
//     req.user = verify.email;
//     next();
//   }

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jakl9vf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        const postsCollection = client.db('bidday').collection('posts')
        const commentsCollection = client.db('bidday').collection('comments')
        const usersCollection = client.db('bidday').collection('user')
        const requestsCollection = client.db('bidday').collection('requests')

        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        // get all sell/bid posts from db
        app.get('/posts', async (req, res) => {
            const result = await postsCollection.find().toArray()
            res.send(result)
        })

        // save a bid post data to db
        app.post('/post', verifyToken, async (req, res) => {
            const postData = req.body
            const result = await postsCollection.insertOne(postData)
            res.send(result)
        })

        // get single volunteer needs post by id for details page
        app.get('/posts/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await postsCollection.findOne(query)
            res.send(result)
        })

        // get a bid post by specific user by email
        app.get('/bidPost/:email', async (req, res) => {
            const email = req.params.email
            const query = { 'seller.email': email }
            const result = await postsCollection.find(query).toArray()
            res.send(result)
        })

        // delete a bid post data from db
        app.delete('/bidPost/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await postsCollection.deleteOne(query)
            res.send(result)
        })

        // update or edit a bid post on db
        app.put('/bidPost/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            const postData = req.body
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    ...postData,
                }
            }
            const result = await postsCollection.updateOne(query, updateDoc, options)
            res.send(result)
        })

        // post social/google user to db
        app.post('/user', async (req, res) => {
            const user = req.body;
            const token = createToken(user)
            console.log(token)
            const isUserExist = await usersCollection.findOne({ email: user?.email });
            console.log('userExist', isUserExist);
            if (isUserExist?._id) {
                return res.send({
                    status: "success",
                    message: "Login Success",
                    token
                });
            }
            await usersCollection.insertOne(user);
            return res.send({token})
        });

        // update user in db & firebase
        app.patch("/user/:email", async (req, res) => {
            const email = req.params.email;
            const userData = req.body;
            const result = await usersCollection.updateOne(
              { email },
              { $set: userData },
              { upsert: true }
            );
            res.send(result);
          });

        // post comment on db
        app.post('/comment', async (req, res) => {
            const commentData = req.body
            const result = await commentsCollection.insertOne(commentData)
            res.send(result)
        })

        // get comments by bidPostId from db
        app.get('/comment/:bidPostId', async (req, res) => {
            const bidPostId = req.params.bidPostId;
            try {
                const comments = await commentsCollection.find({ bidPostId }).sort({ createdAt: -1 }).toArray();
                res.json(comments);
            } catch (err) {
                res.status(500).send(err);
            }
        });

        // save a bid request data to db
        app.post('/request', async (req, res) => {
            const requestData = req.body

            // check if its a duplicate request
            const query = {
                email: requestData.email,
                postId: requestData.postId
            }
            const alreadyRequested = await requestsCollection.findOne(query)
            console.log(alreadyRequested)
            if (alreadyRequested) {
                return res
                .status (400)
                .send('You have already request for this volunteer post')
            }
            const result = await requestsCollection.insertOne(requestData)
            res.send(result)
        })

        // get request by specific user with email
        app.get('/my-request/:email', async (req, res) => {
            const email = req.params.email
            const query = { bidder_email: email }
            const result = await requestsCollection.find(query).toArray()
            res.send(result)
        })

        // get all bid request from db for who post need volunteer
        app.get('/others-request/:email', async (req, res) => {
            const email = req.params.email
            const query = { seller_email: email }
            const result = await requestsCollection.find(query).toArray()
            res.send(result)
        })

        // delete a request data from db
        app.delete('/request/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await requestsCollection.deleteOne(query)
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello from BidDay server')
})


app.listen(port, () => console.log(`BidDay server running on port ${port}`))
