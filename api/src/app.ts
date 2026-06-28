import express from "express"
import dotenv from "dotenv"
import jobRouter from './routes/jobs'
import './worker/jobWorker'
import cors from 'cors'


dotenv.config()
const app = express()

app.use(cors({
    origin: "http://localhost:3000"
}));

const port = process.env.PORT || 3001
app.use(express.json())
app.use("/api/jobs", jobRouter)

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "bug-reproducer-api"
    });
});

app.listen(port, () => {
    console.log(`App is running on port ${port}`)
})