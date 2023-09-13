import express from 'express';
import cors from 'cors';
import path from 'path';
import 'dotenv/config';
const __dirname = path.resolve();


import postRouter from './routes/post.mjs'


const app = express();
app.use(express.json()); // body parser
app.use(cors())

// app.use((req, res, next) => { // JWT
//     let token = "valid"
//     if (token === "valid") {
//         next();
//     } else {
//         res.status(401).send({ message: "invalid token" })
//     }
// })

app.use("/api/v1", postRouter) // Secure api

app.use(express.static(path.join(__dirname, 'web/build')))

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Example server listening on port ${PORT}`)
})
