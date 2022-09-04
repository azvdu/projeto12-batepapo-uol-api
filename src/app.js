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
const sms = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message').required()
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
            time: dayjs().format('HH:mm:ss')
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


app.post('/messages', async (req, res) => {
    const message = req.body
    const user = req.headers.user
    const time = dayjs().format("HH:mm:ss")
    try {
        const {error} = sms.validate(message, {abortEarly: false})
        if(error){
            return res.status(422).send(error.details.map(detail => detail.message))
        }
        if(!user){
            return res.sendStatus(422)
        }
        const from = await db.collection('users').findOne({
            name: user
        })
        if(!from){
            console.log('usuario não encontrado')
            return res.sendStatus(422)
        }
        await db.collection('messages').insertOne({
            from: user,
            to: message.to,
            text: message.text,
            type: message.type,
            time: time
        });
        await db.collection('messages').findOne()
        return res.sendStatus(201)
        
    } catch (error) {
        console.log(error)
        return res.sendStatus(422)
    }
})

app.get('/messages', async (req, res) => {
    const limit = parseInt(req.query.limit)
    const user = req.headers.user
    try {
        const listMessages = await db.collection('messages').find().toArray()
        const messagesFilter = listMessages.filter(message => {
           const forUser =  message.to === user || message.to === "Todos" || message.from === user
           const forAll = message.type === "message"

           return forUser || forAll
        })
        if(!limit){
            return res.send(messagesFilter)
        } else if(messagesFilter.length < limit){
            return res.send(messagesFilter)
        } else{
            await messagesFilter.splice(-limit)
        }
            
        
        return res.send(listMessages)

    } catch (error) {
        console.log(error)
        return res.sendStatus(500)
    }
} )


app.post('/status', async (req, res) => {
    const user = req.headers.user
    try {
        const participant = await db.collection('users').findOne({user})
        if(!participant){
            return res.sendStatus(404)
        } else{
            await db.collection('users').updateOne(participant, {$set:{lastStatus: Date.now()}})
            return res.sendStatus(200)
        }
    } catch (error) {
        console.log(error)
        return res.sendStatus(500)   
    }
})


setInterval(async () => {
    const seconds = Date.now() - 10000
    try {
        const inactiveUser = await db.collection('users').find({lastStatus: {$lte: seconds}}).toArray()
        if(inactiveUser.length > 0){
            await db.collection('messages').insertMany(
                inactiveUser.map(inactiveUser => {
                    return {
                        from: inactiveUser.name,
                        to: "Todos",
                        text: "sai da sala...",
                        type: "status",
                        time: dayjs(seconds).format("HH:mm:ss")
                    }
                })
            )
            await db.collection('users').deleteMany({lastStatus: {$lte: seconds}})
        }
    } catch (error) {
        console.log(error)
        return res.sendStatus(500)
    }
}, 15000)


const PORT = process.env.PORT
app.listen(PORT, () => {
    console.log(`server open in:(http://localhost:${PORT}`)
})