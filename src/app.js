import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
	db = mongoClient.db("test");
});

const app = express()
app.use(cors())
app.use(express.json())


const participant = joi.object({
    name: joi.string().required(),
})

app.post("/participants", async (req, res) => {
    const user = req.body
    try {
        if(!user.name){
            return res.sendStatus(422)
        }

        const validation = participant.validate(user, {abortEarly: false})
        if (validation.error) {
            console.log(validation.error.details)
        }
        
        const checkConflict = await db.collection('users').findOne(user)
        if(checkConflict){
            return res.sendStatus(409)
        }

        await db.collection('users').insertOne({
            name: user.name,
            lastStatus: Date.now()
        })
        
        await db.collection('messages').insertOne({
            from: user.name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:MM:SS')
        })

        return res.sendStatus(201)
    } catch (error) {
        console.log(error)
        return res.sendStatus(500)
    }
})

app.get('/participants', async (req, res) => {
    try {
        const listUsers = await db.collection('users').find().toArray()
        return res.send(listUsers)
    } catch (error) {
        console.log(error)
        return res.sendStatus(500)
    }
})

const PORT = process.env.PORT
app.listen(PORT, () => {
    console.log(`server open in:(http://localhost:${PORT}`)
})