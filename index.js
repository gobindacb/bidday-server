const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000

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

        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        // get all sell/bid posts from db
        app.get('/posts', async (req, res) => {
            const result = await postsCollection.find().toArray()
            res.send(result)
        })

        // save a bid post data to db
        app.post('/post', async (req, res) => {
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
        app.delete('/bidPost/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await postsCollection.deleteOne(query)
            res.send(result)
        })

        // update or edit a bid post on db
        app.put('/bidPost/:id', async (req, res) => {
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
        app.post('/user', async(req, res) =>{
            const user = req.body;
            const isUserExist = await usersCollection.findOne({ email: user?.email});
            console.log(isUserExist);
            if(isUserExist?._id){
                return res.send({
                    status: "success",
                    message: "Login Success",
                });
            }
                const result = await usersCollection.insertOne(user);
                res.send(result)
        })

        // get all comments from db
        app.get('/comments', async (req, res) => {
            const result = await commentsCollection.find().toArray()
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
