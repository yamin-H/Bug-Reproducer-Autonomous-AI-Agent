import express from "express"
import dotenv from "dotenv"
import jobRouter from './routes/jobs'
import './worker/jobWorker'
import cors from 'cors'


dotenv.config()
const app = express()

const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL, "http://localhost:3000"]
    : ["http://localhost:3000"];

// Normalize origins by removing trailing slashes
const normalizedAllowed = allowedOrigins.map(url => url.replace(/\/$/, ""));

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, Render health checks)
        if (!origin) return callback(null, true);
        
        const normalizedOrigin = origin.replace(/\/$/, "");
        if (normalizedAllowed.includes(normalizedOrigin)) return callback(null, true);
        
        callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true
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