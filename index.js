const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.udttjtr.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// JWT token varification
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        const usersCollection = client.db('sellphone').collection('users');
        const categoriesCollection = client.db('sellphone').collection('categories');
        const productsCollection = client.db('sellphone').collection('products');
        const ordersCollection = client.db('sellphone').collection('orders');

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '10d' })
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' })
        })

        // NOTE: make sure you use verifyAdmin after verifyJWT
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        // NOTE: make sure you use verifySeller after verifyJWT
        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'seller') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        app.get('/users', async (req, res) => {
            const email = req.query.email;
            let query = {}
            if (email) {
                query = { email: email };
                const users = await usersCollection.find(query).toArray();
                res.send(users)
            } else {
                const users = await usersCollection.find(query).toArray();
                res.send(users)
            }
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

        // Check the user is admin or not
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        // Check the user is seller or not
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'seller' });
        })

        app.get('/users/allBuyers', verifyJWT, verifyAdmin, async (req, res) => {
            const filter = { role: 'user' };
            const user = await usersCollection.find(filter).toArray();
            res.send(user);
        })

        app.get('/users/allSellers', verifyJWT, verifyAdmin, async (req, res) => {
            const filter = { role: 'seller' };
            const user = await usersCollection.find(filter).toArray();
            res.send(user);
        })

        app.delete('/users/delete/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        })

        app.put('/users/varify/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    varified: true
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        // get all the categories 
        app.get('/categories', async (req, res) => {
            const query = {};
            const categories = await categoriesCollection.find(query).toArray();
            res.send(categories)
        })


        // get category by  category id
        app.get('/categories/id/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const category = await categoriesCollection.findOne(query);
            res.send(category)
        })

        // get category by  category name
        app.get('/categories/:name', async (req, res) => {
            const name = req.params.name;
            const query = { name: name };
            const category = await categoriesCollection.findOne(query);
            res.send(category)
        })


        // get all product
        app.get('/products', async (req, res) => {
            const query = {};
            if (req.query.limit) {
                const limit = parseInt(req.query.limit);
                const product = await productsCollection.find(query).sort({ "publishedDate": -1 }).limit(limit).toArray();
                res.send(product)
            } else {
                const product = await productsCollection.find(query).sort({ "publishedDate": -1 }).toArray();
                res.send(product)
            }
        })

        // get all available product;
        app.get('/products/available', async (req, res) => {
            const query = { status: 'available' };
            if (req.query.limit) {
                const limit = parseInt(req.query.limit);
                const product = await productsCollection.find(query).sort({ "publishedDate": -1 }).limit(limit).toArray();
                res.send(product)
            } else {
                const product = await productsCollection.find(query).sort({ "publishedDate": -1 }).toArray();
                res.send(product)
            }
        })

        // get all product under a category
        app.get('/products/category/:id', async (req, res) => {
            const category = req.params.id;
            const query = { category: category, status: 'available' };
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        })

        // get products for a seller by email
        app.get('/products/seller/:email', verifyJWT, verifySeller, async (req, res) => {
            const email = req.params.email;
            const query = { seller: email };
            const products = await productsCollection.find(query).sort({ "publishedDate": -1 }).toArray();
            res.send(products)
        })

        // add product
        app.post('/products', verifyJWT, verifySeller, async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result)
        })

        app.delete('/products/delete/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(filter);
            res.send(result);
        })


        // Get advertised product
        app.get('/products/advertise', async (req, res) => {
            const query = { advertisement: 'advertised' };
            const product = await productsCollection.find(query).toArray();
            res.send(product)
        })


        // make product advertisement;
        app.put('/products/advertise', async (req, res) => {
            const id = req.query.id;
            const advertisement = req.query.advertisement
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    advertisement: advertisement
                }
            }
            const result = await productsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });


        // get order based on user and based on productId(optional)
        app.get('/orders/:email', verifyJWT, async (req, res) => {
            const email = req.params.email
            const productId = req.query.productId;

            if (productId) {
                const query = { user: email, productId: productId };
                const result = await ordersCollection.find(query).toArray();
                res.send(result);
            } else {
                const query = { user: email };
                const result = await ordersCollection.find(query).toArray();
                res.send(result);
            }
        })

        // add order data to order collection;
        app.post('/orders', verifyJWT, async (req, res) => {
            const order = req.body;
            const result = await ordersCollection.insertOne(order);
            res.send(result)
        })


    }
    finally {

    }
}
run().catch(error => console.error(error.message))


app.get('/', async (req, res) => {
    res.send('sellphone server is running')
})

app.listen(port, () => {
    console.log(`sellphone running on ${port}`);
})