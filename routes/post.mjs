
import express from 'express';
import { customAlphabet } from 'nanoid'
import { client } from './../mongodb.mjs';
// import { ObjectId } from 'mongodb';
import pineconeClient
, { openai as openaiClient }
    from './../pinecone.mjs';

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10)

const db = client.db("cruddb");
const col = db.collection("posts");

const pcIndex = pineconeClient.Index(process.env.PINECONE_INDEX_NAME);
console.log("process.env.PINECONE_INDEX_NAME: ", process.env.PINECONE_INDEX_NAME);

let router = express.Router()



// POST    /api/v1/post
router.post('/post', async (req, res, next) => {
    console.log('this is signup!', new Date());

    if (
        !req.body.title
        || !req.body.text
    ) {
        res.status(403);
        res.send(`required parameters missing, 
        example request body:
        {
            title: "abc post title",
            text: "some post text"
        } `);
        return;
    }

    try {
        const insertResponse = await col.insertOne({
            // _id: "7864972364724b4h2b4jhgh42",
            title: req.body.title,
            text: req.body.text,
            createdOn: new Date()
        });
        console.log("insertResponse: ", insertResponse);

        const response = await openaiClient.embeddings.create({
            model: "text-embedding-ada-002",
            input: `${req.body.title} ${req.body.text}`,
        });
        const vector = response?.data[0]?.embedding

        console.log("vector: ", vector);

        const upsertResponse = await pcIndex.upsert([{
            id: nanoid(), // unique id
            values: vector,
            metadata: {
                title: req.body.title,
                text: req.body.text,
                createdOn: (new Date()).getTime(),
            },
        }]);
        console.log("upsertResponse: ", upsertResponse);


        res.send({ message: 'post created' });
    } catch (e) {
        console.log("error inserting mongodb: ", e);
        res.status(500).send({ message: 'server error, please try later' });
    }
})


router.get('/posts', async (req, res, next) => {

    // const cursor = col.find({})
    //     .sort({ _id: -1 })
    //     .limit(100);

    // try {
    //     let results = await cursor.toArray()
    //     console.log("results: ", results);
    //     res.send(results);
    // } catch (e) {
    //     console.log("error getting data mongodb: ", e);
    //     res.status(500).send('server error, please try later');
    // }

    try {
        const response = await openaiClient.embeddings.create({
            model: "text-embedding-ada-002",
            input: "",
        });
        const vector = response?.data[0]?.embedding
        // const vector = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

        console.log("vector: ", vector);
        // [ 0.0023063174, -0.009358601, 0.01578391, ... , 0.01678391, ]

        const queryResponse = await pcIndex.query({
            vector: vector,
            // id: "vec1",
            topK: 10000,
            includeValues: false,
            includeMetadata: true,
        });

        queryResponse.matches.map(eachMatch => {
            console.log(`score ${eachMatch.score.toFixed(1)} => ${JSON.stringify(eachMatch.metadata)}\n\n`);
        })
        console.log(`${queryResponse.matches.length} records found `);

        const formattedOutput = queryResponse.matches.map(eachMatch => ({
            text: eachMatch?.metadata?.text,
            title: eachMatch?.metadata?.title,
            _id: eachMatch?.id,
            time: new Date(eachMatch?.metadata?.createdOn).toLocaleString(),
        }))

        res.send(formattedOutput);

    } catch (e) {
        console.log("error getting data pinecone: ", e);
        res.status(500).send('server error, please try later');
    }

})


router.get('/search', async (req, res, next) => {

    try {
        const response = await openaiClient.embeddings.create({
            model: "text-embedding-ada-002",
            input: req.query.q,
        });
        // const vector = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        const vector = response?.data[0]?.embedding
        console.log("vector: ", vector);
        // [ 0.0023063174, -0.009358601, 0.01578391, ... , 0.01678391, ]

        const queryResponse = await pcIndex.query({
            vector: vector,
            // id: "vec1",
            topK: 20,
            includeValues: false,
            includeMetadata: true
        });

        queryResponse.matches.map(eachMatch => {
            console.log(`score ${eachMatch.score.toFixed(3)} => ${JSON.stringify(eachMatch.metadata)}\n\n`);
        })
        console.log(`${queryResponse.matches.length} records found `);

        const formattedOutput = queryResponse.matches.map(eachMatch => ({
            text: eachMatch?.metadata?.text,
            title: eachMatch?.metadata?.title,
            _id: eachMatch?.id,
        }))

        res.send(formattedOutput);

    } catch (e) {
        console.log("error getting data pinecone: ", e);
        res.status(500).send('server error, please try later');
    }

})
//new api for single post

// PUT     /api/v1/post/:postId
// {
//     title: "updated title",
//     text: "updated text"
// }

router.put('/post/:postId', async (req, res, next) => {

    // if (!ObjectId.isValid(req.params.postId)) {
    //     res.status(403).send(`Invalid post id`);
    //     return;
    // }

    if (!req.body.text
        && !req.body.title) {
        res.status(403).send(`required parameter missing, atleast one key is required.
        example put body: 
        PUT     /api/v1/post/:postId
        {
            title: "updated title",
            text: "updated text"
        }
        `)
    }

    // let dataToBeUpdated = {};
    // if (req.body.title) { dataToBeUpdated.title = req.body.title }
    // if (req.body.text) { dataToBeUpdated.text = req.body.text }
    // try {
    //     const updateResponse = await col.updateOne(
    //         {
    //             _id: new ObjectId(req.params.postId)
    //         },
    //         {
    //             $set: dataToBeUpdated
    //         });
    //     console.log("updateResponse: ", updateResponse);

    //     res.send('post updated');
    // } catch (e) {
    //     console.log("error inserting mongodb: ", e);
    //     res.status(500).send('server error, please try later');
    // }

    try {
        const response = await openaiClient.embeddings.create({
            model: "text-embedding-ada-002",
            input: `${req.body.title} ${req.body.text}`,
        });
        // const vector = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        const vector = response?.data[0]?.embedding
        console.log("vector: ", vector);

        const upsertResponse = await pcIndex.upsert([{
            id: req.params.postId,
            values: vector,
            metadata: {
                title: req.body.title,
                text: req.body.text,
            },
        }]);
        console.log("upsertResponse: ", upsertResponse);


        res.send({ message: 'post created' });
    } catch (e) {
        console.log("error inserting mongodb: ", e);
        res.status(500).send({ message: 'server error, please try later' });
    }

})


// DELETE  /api/v1/post/:postId
router.delete('/post/:postId', async (req, res, next) => {

    // if (!ObjectId.isValid(req.params.postId)) {
    //     res.status(403).send(`Invalid post id`);
    //     return;
    // }

    // try {
    //     const deleteResponse = await col.deleteOne({ _id: new ObjectId(req.params.postId) });
    //     console.log("deleteResponse: ", deleteResponse);
    //     res.send('post deleted');
    // } catch (e) {
    //     console.log("error deleting mongodb: ", e);
    //     res.status(500).send('server error, please try later');
    // }


    const deleteResponse = await pcIndex.deleteOne(req.params.postId)
    console.log("deleteResponse: ", deleteResponse);

    res.send('post deleted');
})


// delete all

router.delete('/posts/all', async (req, res) => {
    try {
        // Perform a delete operation to remove all records from the Pinecone index
        const deleteResponse = await pcIndex.deleteAll();

        // Check the deleteResponse status (e.g., 'ok' indicates success)
        if (deleteResponse.status === 'ok') {
            res.status(200).json({ message: 'All posts deleted successfully.' });
        } else {
            res.status(500).json({ message: 'Failed to delete all posts.' });
        }
    } catch (error) {
        console.error('Error deleting all posts:', error);
        res.status(500).json({ message: 'Server error, please try later.' });
    }
});

// search

router.get('/search', async (req, res, next) => {

    try {
        const response = await openaiClient.embeddings.create({
            model: "text-embedding-ada-002",
            input: req.query.q,
        });
        const vector = response?.data[0]?.embedding
        console.log("vector: ", vector);
        // [ 0.0023063174, -0.009358601, 0.01578391, ... , 0.01678391, ]

        const queryResponse = await pcIndex.query({
            vector: vector,
            // id: "vec1",
            topK: 20,
            includeValues: false,
            includeMetadata: true
        });

        queryResponse.matches.map(eachMatch => {
            console.log(`score ${eachMatch.score.toFixed(3)} => ${JSON.stringify(eachMatch.metadata)}\n\n`);
        })
        console.log(`${queryResponse.matches.length} records found `);

        const formattedOutput = queryResponse.matches.map(eachMatch => ({
            text: eachMatch?.metadata?.text,
            title: eachMatch?.metadata?.title,
            _id: eachMatch?.id,
        }))

        res.send(formattedOutput);

    } catch (e) {
        console.log("error getting data pinecone: ", e);
        res.status(500).send('server error, please try later');
    }

})

export default router


