import express from 'express';
import taskRoutes from './routes/taskRoutes.ts';

const app = express(); // Initialize the Express application
const port = process.env.PORT; // Get the port from the environment variables

app.use(express.json()); // Read raw text -> parse into JSON -> attach to req.body
app.use('/tasks', taskRoutes); // Forward the entire request over to the taskRoutes router if the URL starts with /tasks

app.listen(port, () => { // Start the server and listen for incoming requests
    console.log(`Server running at http://localhost:${port}`);
});
